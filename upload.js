const axios = require('axios');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { removeColonPrefix, getAllFiles } = require('./utils.js');

async function uploadFile(filePath, languageCode, projectId, token, isNested, overrideTranslations, newKeysTags, updatedKeysTags) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath);
    const contentType = `text/${path.extname(filePath).replace('.', '')}`;

    const uploadResponse = await axios.post(`https://api.translized.com/upload/${fileName}`, fileContent, {
      headers: { 'Content-Type': contentType },
    });

    if (uploadResponse.status === 201) {
      console.log("Uploaded file:", filePath);
      console.log("Importing translations...");
      console.log("");

      const importResponse = await axios.post('https://api.translized.com/import', {
        projectId,
        languageCode,
        fileURL: uploadResponse.data.url,
        isNested,
        overrideTranslations,
        processingRules: {
          overrideImportAutomations: true,
          newKeys: newKeysTags.length ? { tags: newKeysTags } : {},
          updatedKeys: updatedKeysTags.length ? { tags: updatedKeysTags } : {},
        },
      }, {
        headers: {
          'Content-Type': 'application/json',
          'api-token': token,
        },
      });

      if (importResponse.status === 200) {
        const result = importResponse.data.result;
        console.log("\x1b[32m%s\x1b[0m", "Total parsed: " + result.totalParsed);
        console.log("\x1b[32m%s\x1b[0m", "Total added: " + result.totalAdded);
        console.log("\x1b[32m%s\x1b[0m", "Total updated: " + result.totalUpdated);
        console.log("");
      } else {
        console.log("\x1b[31m%s\x1b[0m", importResponse.data.error);
      }
    } else {
      console.log("\x1b[31m%s\x1b[0m", uploadResponse.data.error);
    }
  } catch (error) {
    console.error(error.message);
  }
}

async function processUploadConfig(uploadConfig, projectId, token) {
  for (const upload of uploadConfig) {
    const filePath = upload.path;
    const languageCode = upload.language_code;
    const isNested = upload.isNested || false;

    if (!projectId || !token || !filePath || (!filePath.includes("<locale_code>") && !languageCode)) {
      console.log("\x1b[31m%s\x1b[0m", "Missing required configuration in .translized.yml file");
      return;
    }

    const tags = upload.tags || {};
    const newKeysTagsString = tags.new_keys;
    const updatedKeysTagsString = tags.updated_keys;
    const overrideTranslations = upload.update_translations === true;
    const newKeysTags = newKeysTagsString ? newKeysTagsString.split(',').map(tag => tag.trim()) : [];
    const updatedKeysTags = updatedKeysTagsString ? updatedKeysTagsString.split(',').map(tag => tag.trim()) : [];

    const filePaths = filePath.includes("<locale_code>") ?
      getAllFiles('./').filter(file => file.startsWith(filePath.split("<locale_code>")[0]) && file.endsWith(filePath.split("<locale_code>")[1]))
        .map(file => ({ filePath: file, languageCode: file.replace(filePath.split("<locale_code>")[0], '').replace(filePath.split("<locale_code>")[1], '') })) :
      [{ filePath, languageCode }];

    for (const fileObj of filePaths) {
      await uploadFile(fileObj.filePath, fileObj.languageCode, projectId, token, isNested, overrideTranslations, newKeysTags, updatedKeysTags);
    }
  }
}

async function main() {
  try {
    const config = removeColonPrefix(yaml.load(fs.readFileSync('.translized.yml', 'utf8')));
    const projectId = config.translized.project_id;
    const token = config.translized.access_token;
    let uploadConfig = config.translized.upload;

    if (!Array.isArray(uploadConfig)) {
      uploadConfig = [uploadConfig];
    }

    await processUploadConfig(uploadConfig, projectId, token);
  } catch (error) {
    console.error(error.message);
  }
}

// Run the main function
main();
