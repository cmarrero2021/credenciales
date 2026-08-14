const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const MAX_PHOTO_BYTES = 1024 * 1024;
const CARNET_DIMENSIONS = [
    { width: 300, height: 375 },
    { width: 360, height: 450 },
    { width: 420, height: 525 },
    { width: 480, height: 600 }
];

async function processUploadedImage(file) {
    if (!file || !file.path) {
        return null;
    }

    const inputPath = file.path;
    if (!fs.existsSync(inputPath)) {
        return null;
    }

    let metadata;
    try {
        metadata = await sharp(inputPath).metadata();
    } catch (error) {
        console.warn('[photoProcessor] No se pudo leer la imagen para procesar:', error.message);
        return inputPath;
    }

    if (!metadata || !metadata.width || !metadata.height || !metadata.format) {
        return inputPath;
    }

    const outputDir = path.dirname(inputPath);
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const outputPath = path.join(outputDir, `${baseName}.jpg`);

    try {
        let lastError = null;

        for (const size of CARNET_DIMENSIONS) {
            const tempPath = path.join(outputDir, `${baseName}_tmp_${size.width}x${size.height}.jpg`);

            for (const quality of [92, 88, 84, 80, 76, 72, 68, 64, 58, 54, 50]) {
                try {
                    await sharp(inputPath)
                        .rotate()
                        .resize(size.width, size.height, {
                            fit: 'cover',
                            position: 'center'
                        })
                        .flatten({ background: { r: 255, g: 255, b: 255 } })
                        .jpeg({ quality, progressive: true, mozjpeg: true })
                        .toFile(tempPath);

                    const bytes = fs.statSync(tempPath).size;
                    if (bytes <= MAX_PHOTO_BYTES) {
                        if (fs.existsSync(outputPath)) {
                            fs.unlinkSync(outputPath);
                        }
                        fs.renameSync(tempPath, outputPath);
                        if (fs.existsSync(inputPath)) {
                            fs.unlinkSync(inputPath);
                        }
                        return outputPath;
                    }
                } catch (error) {
                    lastError = error;
                }
            }
        }

        const fallbackPath = path.join(outputDir, `${baseName}_fallback.jpg`);
        await sharp(inputPath)
            .rotate()
            .resize(300, 375, {
                fit: 'cover',
                position: 'center'
            })
            .flatten({ background: { r: 255, g: 255, b: 255 } })
            .jpeg({ quality: 55, progressive: true, mozjpeg: true })
            .toFile(fallbackPath);

        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }
        fs.renameSync(fallbackPath, outputPath);
        if (fs.existsSync(inputPath)) {
            fs.unlinkSync(inputPath);
        }

        if (lastError) {
            console.warn('[photoProcessor] Se aplicó fallback de compresión por:', lastError.message);
        }

        return outputPath;
    } catch (error) {
        console.warn('[photoProcessor] No se pudo procesar la imagen:', error.message);
        return inputPath;
    }
}

async function processUploadedFiles(req, res, next) {
    try {
        if (req.file) {
            const processedPath = await processUploadedImage(req.file);
            if (processedPath) {
                req.file.path = processedPath;
                req.file.filename = path.basename(processedPath);
            }
        }

        if (Array.isArray(req.files) && req.files.length > 0) {
            for (const file of req.files) {
                const processedPath = await processUploadedImage(file);
                if (processedPath) {
                    file.path = processedPath;
                    file.filename = path.basename(processedPath);
                }
            }
        }

        next();
    } catch (error) {
        console.warn('[photoProcessor] Error al procesar archivos subidos:', error.message);
        next();
    }
}

module.exports = {
    processUploadedImage,
    processUploadedFiles
};
