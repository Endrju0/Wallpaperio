const electron = require('electron');
const request = require('request');
const fs = require('fs');
const wallpaper = require('wallpaper');

const {app, Menu, Tray} = electron;

// env variables
PHOTO_URL = 'https://picsum.photos/200/300';

let tray;

// Listen for app to be ready
app.on('ready', function() {
    // Tray menu
    tray = new Tray('assets/icons/win/icon.ico');
    const contextMenu = Menu.buildFromTemplate(trayMenuTemplate);
    tray.setToolTip('Wallpaperio');
    tray.setContextMenu(contextMenu);
});

// Create tray menu template
const trayMenuTemplate = [
    { 
        label: 'Get wallpaper',
        click() {
            // Format file path
            let date = new Date().toLocaleString();
            let path = 'data/' + date.replace(/:\s*/g, ";") + '.jpg'

            // If photo is downloaded, save it as wallpaper
            downloadFile(PHOTO_URL, path).then(function(){
                wallpaper.set(path);
            });
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