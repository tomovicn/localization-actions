const fs = require('fs');

function removeColonPrefix(jsonObj) {
    if (typeof jsonObj !== 'object' || jsonObj === null) {
        // If the input is not an object or is null, return the input as is
        return jsonObj;
    }

    if (Array.isArray(jsonObj)) {
        // If the input is an array, process each element recursively
        return jsonObj.map(removeColonPrefix);
    }

    // If the input is an object, process each key and its value recursively
    const result = {};
    for (const key in jsonObj) {
        if (jsonObj.hasOwnProperty(key)) {
            const newKey = key.startsWith(':') ? key.slice(1) : key;
            result[newKey] = removeColonPrefix(jsonObj[key]);
        }
    }

    return result;
}

function getAllFiles(dir, filelist) {
    files = fs.readdirSync(dir);
    filelist = filelist || [];
    files.forEach(function (file) {
        if (fs.statSync(dir + file).isDirectory()) {
            filelist = getAllFiles(dir + file + '/', filelist);
        }
        else {
            filelist.push(dir + file);
        }
    });
    return filelist;
};

function createDirectory(dirname) {
    if (!fs.existsSync(dirname)) {
        fs.mkdirSync(dirname, { recursive: true });
    }
}

module.exports = {
    removeColonPrefix,
    getAllFiles,
    createDirectory
}