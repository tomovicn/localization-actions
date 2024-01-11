const axios = require('axios');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { removeColonPrefix, createDirectory } = require('./utils');

async function downloadFile(uri, filename, token, locale, downloadPath) {
    try {
        const response = await axios.get(uri, {
            responseType: 'stream',
            headers: {
                'api-token': token,
            },
        });

        const fullPath = path.join(downloadPath, filename);
        createDirectory(downloadPath);

        const writer = fs.createWriteStream(fullPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                console.log("\x1b[32m%s\x1b[0m", `Downloaded ${locale} to ${fullPath}`);
                resolve();
            });

            writer.on('error', (err) => {
                console.error(err.message);
                reject(err);
            });
        });
    } catch (error) {
        console.log("\x1b[31m%s\x1b[0m", `=> Exception: '${error.message}'. Skipping download.`);
    }
}

async function main() {
    try {
        const config = removeColonPrefix(yaml.load(fs.readFileSync('.translized.yml', 'utf8')));
        const projectId = config.translized.project_id;
        const token = config.translized.access_token;
        let downloadConfig = config.translized.download;

        if (!projectId || !token) {
            console.log("\x1b[31m%s\x1b[0m", "Missing required configuration in .translized.yml file");
            return;
        }

        if (!Array.isArray(downloadConfig)) {
            downloadConfig = [downloadConfig];
        }

        const scriptDir = process.cwd();

        for (const download of downloadConfig) {
            const fileFormat = download.file_format;
            const downloadPath = download.path;
            const isNested = download.isNested || false;
            const downloadOptions = download.options;
            const tagsString = download.tags;
            const tags = tagsString ? tagsString.split(',').map(tag => tag.trim()) : [];

            if (!fileFormat) {
                console.log("\x1b[31m%s\x1b[0m", "Please input file_format in .translized.yml file");
                return;
            }

            if (!downloadPath) {
                console.log("\x1b[31m%s\x1b[0m", "Please input download path in .translized.yml file");
                return;
            }

            const apiUrl = 'https://api.translized.com/project/exportAll';
            const requestBody = {
                projectId,
                exportFormat: fileFormat,
                isNested,
                tags,
                ...downloadOptions,
            };

            const response = await axios.post(apiUrl, requestBody, {
                headers: {
                    'Content-Type': 'application/json',
                    'api-token': token,
                },
            });

            const jsonResponse = response.data;

            if (response.status === 200) {
                jsonResponse.result.map(async (item) => {
                    const [locale, { fileURL }] = Object.entries(item)[0];
                    const uriLocale = fileURL;
                    const dirname = path.dirname(downloadPath).replace('<locale_code>', locale);
                    const filename = path.basename(downloadPath).replace('<locale_code>', locale);

                    // For Android, remove language code from directory name for English locale
                    if (fileFormat === 'xml' && locale === 'en') {
                        dirname = dirname.replace(`-${locale}`, '');
                    }

                    process.chdir(scriptDir);

                    if (dirname) {
                        createDirectory(dirname);
                        // process.chdir(dirname);
                    }

                    await downloadFile(uriLocale, filename, token, locale, dirname);
                });
            } else {
                console.log("\x1b[31m%s\x1b[0m", jsonResponse.error);
            }
        }
    } catch (error) {
        console.error(error.message);
    }
}

// Run the main function
main();
