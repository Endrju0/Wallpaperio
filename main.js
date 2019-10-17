const electron = require('electron');
const request = require('request');
const fs = require('fs');
const wallpaper = require('wallpaper');

const {app, Menu, Tray, dialog} = electron;

// env variables
PHOTO_URL = 'https://picsum.photos/200/300';    //https://www.nationalgeographic.com/photography/photo-of-the-day/

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
     // Format file path
     let date = new Date().toLocaleString();
     let path = 'data/' + date.replace(/:\s*/g, ";") + '.jpg'

     // If photo is downloaded, save it as wallpaper
     downloadFile(PHOTO_URL, path).then(function(){
         wallpaper.set(path);
     });
}

// Function to save file from url to specific path
function downloadFile(file_url, targetPath) {
    return new Promise(function(resolve, reject){
        var req = request({
            method: 'GET',
            uri: file_url
        });

        var out = fs.createWriteStream(targetPath);
        req.pipe(out);

        req.on('end', function() {
            console.log("File " + targetPath + " successfully downloaded");
            resolve();
        });
    });
}

// Random photo from /data
function randomPhoto() {
    fs.readdir('data', (err, files) => {
        // Set random wallpaper if /data isn't empty
        if(Array.isArray(files) && files.length) {
            var rand = files[Math.floor(Math.random() * files.length)];
            wallpaper.set('data/'+rand);
        } else {
            // Or download new one
            dialog.showMessageBox(randomPhotoDialog, i => {
                if(i==0) getPhoto();
            })
        } 
    });
}