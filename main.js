const electron = require('electron');
const request = require('request');
const fs = require('fs');
const wallpaper = require('wallpaper');
const cheerio = require('cheerio');

const {app, Menu, Tray, dialog} = electron;

// env variables
// const PHOTO_URL = 'https://picsum.photos/200/300';
const PHOTO_URL = 'https://www.nationalgeographic.com/photography/photo-of-the-day/';
const INTERVAL_TIME = 5000;

/**
 * Variables
 */
var slideshow_queue = [];
var interval = setInterval(() => slideShow(), INTERVAL_TIME);

let tray;


/**
 * App
 */

// Listen for app to be ready
app.on('ready', function() {
    // Tray menu
    tray = new Tray('assets/icons/win/icon.ico');
    const contextMenu = Menu.buildFromTemplate(trayMenuTemplate);
    tray.setToolTip('Wallpaperio');
    tray.setContextMenu(contextMenu);

    // Quit app when tray is closed
    tray.on('closed', function() {
        app.quit();
    });
});

/**
 * Templates
 */

// Create tray menu template
const trayMenuTemplate = [
    { 
        label: 'Get wallpaper',
        click() {
            getPhoto();
        } 
    },
    {
        label: 'Random photo',
        click() {
            randomPhoto();
        }
    },
    {
        label: 'Quit',
        accelerator: 'CmdOrCtrl+Q',
        click() {
            app.quit();
        }
    }
];

// Dialog to confirm if user want to download new photo if there isn't any
const randomPhotoDialog = {
    type: 'info',
    buttons: ['OK', 'Cancel'],
    message: 'You don\'t have any photos downloaded. Do you want to download the latest one?'
}

/**
 * Functions
 */

 // Download new photo -> save as file with datetime in name -> set it as wallpaper
function getPhoto() {
    
    // let date = new Date().toLocaleString();
    // let path = 'data/' + date.replace(/:\s*/g, ";") + '.jpg'
    // downloadFile(PHOTO_URL, path).then(function(){
    //     wallpaper.set(path);
    // })

    // Get body from html request
    request(PHOTO_URL, (error, response, html) => {
        if(!error && response.statusCode == 200) {
            // Search through body to find og:image link
            var $ = cheerio.load(html);
            var img = $('meta[property="og:image"]').attr('content');
            
            // Format file path
            let date = new Date().toLocaleString();
            let path = 'data/' + date.replace(/:\s*/g, ";") + '.jpg'

            // If photo is downloaded, save it as wallpaper
            downloadFile(img, path).then(function(){
                wallpaper.set(path);

                // Restart interval time
                clearInterval(interval);
                interval = setInterval(() => slideShow(), INTERVAL_TIME);
            });
        }
    }) 
}

// Function to save file from url to specific path
function downloadFile(file_url, targetPath) {
    return new Promise(function(resolve, reject){
        // Get file from url
        var req = request({
            method: 'GET',
            uri: file_url
        });

        // Save file to targetPath
        var out = fs.createWriteStream(targetPath);
        req.pipe(out);

        req.on('end', function() {
            console.log("File " + targetPath + " successfully downloaded");
            resolve();
        });

        req.on('error', (e) => {
            console.log(e);
        });
    });
}

// Set random photo as wallpaper from /data or download new one
function randomPhoto() {
    fs.readdir('data', (err, files) => {
        // Set random wallpaper if /data isn't empty
        if(Array.isArray(files) && files.length) {
            var rand = files[Math.floor(Math.random() * files.length)];

            wallpaper.get().then(function(result) {
                // Get filename instead of full path
                var current_wallpaper = result.substring(result.lastIndexOf('\\'||'\/') + 1);

                // If selected photo doesn't match wallpaper filename -> set is as wallpaper
                if(current_wallpaper != rand) {
                    wallpaper.set('data/'+rand);
                    
                    // Restart interval time
                    clearInterval(interval);
                    interval = setInterval(() => slideShow(), INTERVAL_TIME);
                } else randomPhoto();
            });
        } else {
            // Or download new one
            dialog.showMessageBox(randomPhotoDialog, i => {
                if(i==0) getPhoto();
            })
        } 
    });
}

// Set wallpaper in interval
function slideShow() {
    // If slideshow queue isn't empty pop latest photo and set is as wallpaper
    if(Array.isArray(slideshow_queue) && slideshow_queue.length) {
        wallpaper.set('data/'+slideshow_queue.pop());
    } else {
        // If slideshow queue is empty, push all photos from /data
        var files = fs.readdirSync('data');
        if(Array.isArray(files) && files.length) {
            for (var i in files) {
                slideshow_queue.push(files[i]); 
            }
        } else {
            // If there isn't any photos
            dialog.showMessageBox(randomPhotoDialog, i => {
                if(i==0) getPhoto();
            });
        }
    }
}