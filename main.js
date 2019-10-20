const electron = require('electron');
const request = require('request');
const fs = require('fs');
const wallpaper = require('wallpaper');
const cheerio = require('cheerio');
const notifier = require('node-notifier');

const {app, Menu, Tray, dialog} = electron;

// env variables
// const PHOTO_URL = 'https://picsum.photos/200/300';
const PHOTO_URL = 'https://www.nationalgeographic.com/photography/photo-of-the-day/';
const INTERVAL_TIME = 5000;
const CONN_ATTEMPT = 5;
const DEBUG = true;

/**
 * Variables
 */
var slideshow_queue = [];
var interval = setInterval(() => slideShow(), INTERVAL_TIME);
var tcp_err_ctr = 0;
var user_relative_path = 'data/';

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
        label: 'Dislike this wallpaper',
        click() {
            banWallpaper();
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
    if(DEBUG) console.log('getPhoto');
    // let date = new Date().toLocaleString();
    // let path = user_relative_path + date.replace(/:\s*/g, ";") + '.jpg'
    // downloadFile(PHOTO_URL, path).then(function(){
    //     wallpaper.set(path);
    // })

    // Get body from html request
    request(PHOTO_URL, (error, response, html) => {
        if(!error && response.statusCode == 200) {
            if(DEBUG) console.log('Request success');
            // Search through body to find og:image link
            var $ = cheerio.load(html);
            var img = $('meta[property="og:image"]').attr('content');
            
            // Format file path
            let date = new Date().toLocaleString();
            let path = user_relative_path + date.replace(/:\s*/g, ";") + '.jpg'
            if(DEBUG) console.log('Path: ' + path);

            // If photo is downloaded, save it as wallpaper
            downloadFile(img, path).then(function(){
                wallpaper.set(path);
            }).then(function() {
                // Restart interval time
                clearInterval(interval);
                interval = setInterval(() => slideShow(), INTERVAL_TIME);
                notifier.notify({
                    title: 'Wallpaperio - Information',
                    message: 'Successfully downloaded new wallpaper.',
                    sound: true,
                });
            });
        } else {
            if(DEBUG) console.log('Request rejected: ' + tcp_err_ctr);
            if(tcp_err_ctr++ < CONN_ATTEMPT ) getPhoto();
            else {
                tcp_err_ctr = 0;
                notifier.notify({
                    title: 'Wallpaperio - Warning',
                    message: 'National Geographic server is currently unavailable. Please try again later.',
                    sound: true,
                });
            }
        }
    }) 
}

// Function to save file from url to specific path
function downloadFile(file_url, target_path) {
    if(DEBUG) console.log('Downloading');
    return new Promise(function(resolve, reject){
        if(DEBUG) var received_bytes = 0;

        // Get file from url
        var req = request({
            method: 'GET',
            uri: file_url
        });

        // Save file to target_path
        var out = fs.createWriteStream(target_path);
        req.pipe(out);
        
        if(DEBUG) {
            // Update the received bytes
            req.on(user_relative_path, function(chunk) {
                received_bytes += chunk.length;
                showProgress(received_bytes);
            });
        }
        req.on('end', function() {
            console.log("File " + target_path + " successfully downloaded");
            resolve();
        });

        req.on('error', (e) => {
            // ECONNRESET, after 5 attempts stop downloading file
            if(DEBUG) {
                console.log(e);
                console.log('Downloading attempt: ' + tcp_err_ctr);
            }
            if(tcp_err_ctr++ < CONN_ATTEMPT ) downloadFile(file_url, target_path)
            else {
                // End stream and delete file
                out.end();
                fs.unlink(target_path, (err) => {
                    if (err) throw err;
                    console.log('successfully deleted');
                });
                tcp_err_ctr = 0;
                notifier.notify({
                    title: 'Wallpaperio - Warning',
                    message: 'National Geographic server was busy. Please try again.',
                    sound: true,
                });
            }
        });
    });
}

function showProgress(received){
    console.log(received + " bytes.");
}

// Set random photo as wallpaper from user_relative_path or download new one
function randomPhoto() {
    fs.readdir(user_relative_path, (err, files) => {
        // Set random wallpaper if user_relative_path isn't empty
        if(Array.isArray(files) && files.length) {
            var rand = files[Math.floor(Math.random() * files.length)];

            wallpaper.get().then(function(result) {
                // Get filename instead of full path
                var current_wallpaper = result.substring(result.lastIndexOf('\\'||'\/') + 1);
                // If selected photo doesn't match wallpaper filename -> set is as wallpaper
                // and if wallpaper isn't banned
                if(current_wallpaper != rand && !isBanned(rand)) {
                    wallpaper.set(user_relative_path+rand);
                    
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
        wallpaper.set(user_relative_path+slideshow_queue.pop());
    } else {
        // If slideshow queue is empty, push all photos from user_relative_path
        var files = fs.readdirSync(user_relative_path);
        if(Array.isArray(files) && files.length) {
            for (var i in files) {
                isBanned(files[i])? false : slideshow_queue.push(files[i]); 
            }
        } else {
            // If there isn't any photos
            clearInterval(interval);
            dialog.showMessageBox(randomPhotoDialog, i => {
                if(i==0) getPhoto();
            });
        }
    }
}

// Add _banned in name to prevent using this file as wallpaper
function banWallpaper() {
    if(DEBUG) console.log('banWallpaper');
    wallpaper.get().then(function(result) {
        // Get filename instead of full path
        var old_wallpaper = user_relative_path + result.substring(result.lastIndexOf('\\'||'\/') + 1);
        var current_wallpaper = user_relative_path + result.substring(result.lastIndexOf('\\'||'\/') + 1).replace(/\.[^/.]+$/, "")+'_banned.jpg';
        if(DEBUG) {
            console.log(old_wallpaper);
            console.log(current_wallpaper);
        }
        fs.rename(old_wallpaper, current_wallpaper, function(err) {
            if ( err ) console.log('ERROR: ' + err);
        });
    });
}

// Check if filename ends with _banned (without extension) 52_banned.jpg -> _banned
function isBanned(file_name) {
    var file_name = file_name.replace(/\.[^/.]+$/, "").substring(file_name.lastIndexOf('_') + 1);
    return file_name === 'banned' ? true : false;
}