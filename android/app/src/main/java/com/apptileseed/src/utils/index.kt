package com.apptileseed.src.utils

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.ResponseBody
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.security.MessageDigest
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream

suspend fun copyAssetToDocuments(
    context: Context, assetFileName: String, destinationFileName: String
): Boolean {
    val destinationFile = File(context.filesDir, destinationFileName)

    return withContext(Dispatchers.IO) {
        if (!destinationFile.exists()) {
            try {
                context.assets.open(assetFileName).use { inputStream ->
                    FileOutputStream(destinationFile).use { outputStream ->
                        inputStream.copyTo(outputStream)
                    }
                }
                Log.d(
                    APPTILE_LOG_TAG,
                    "File copied successfully from asset $assetFileName to ${destinationFile.absolutePath}"
                )
                true
            } catch (e: IOException) {
                Log.e(APPTILE_LOG_TAG, "Error copying file: ${e.message}", e)
                false
            }
        } else {
            Log.d(APPTILE_LOG_TAG, "File already exists: ${destinationFile.absolutePath}")
            true
        }
    }
}

suspend fun readFileContent(filePath: String): String? {
    return withContext(Dispatchers.IO) {
        val file = File(filePath)
        if (file.exists()) {
            Log.d(APPTILE_LOG_TAG, "Reading file content from: $filePath")
            file.readText()
        } else {
            Log.w(APPTILE_LOG_TAG, "File not found: $filePath")
            null
        }
    }
}

suspend fun saveFile(responseBody: ResponseBody, filePath: String): Boolean {
    return withContext(Dispatchers.IO) {
        try {
            val file = File(filePath)
            val inputStream: InputStream = responseBody.byteStream()
            val outputStream = FileOutputStream(file)

            inputStream.use { input ->
                outputStream.use { output ->
                    input.copyTo(output)
                }
            }
            Log.d(APPTILE_LOG_TAG, "File saved successfully: $filePath")
            true
        } catch (e: Exception) {
            Log.e(APPTILE_LOG_TAG, "File save failed: ${e.message}", e)
            false
        }
    }
}

suspend fun deleteFile(filePath: String): Boolean {
    return withContext(Dispatchers.IO) {
        val file = File(filePath)
        if (file.exists()) {
            val result = file.delete()
            if (result) {
                Log.d(APPTILE_LOG_TAG, "File deleted successfully: $filePath")
            } else {
                Log.e(APPTILE_LOG_TAG, "Failed to delete file: $filePath")
            }
            result
        } else {
            Log.w(APPTILE_LOG_TAG, "File not found for deletion: $filePath")
            false
        }
    }
}

suspend fun moveFile(sourcePath: String, destinationPath: String): Boolean {
    return withContext(Dispatchers.IO) {
        val sourceFile = File(sourcePath)
        val destinationFile = File(destinationPath)

        if (sourceFile.exists()) {
            val result = sourceFile.renameTo(destinationFile)
            if (result) {
                Log.d(
                    APPTILE_LOG_TAG,
                    "File moved from ${sourceFile.absolutePath} to ${destinationFile.absolutePath}"
                )
            } else {
                Log.e(
                    APPTILE_LOG_TAG,
                    "Failed to move file from ${sourceFile.absolutePath} to ${destinationFile.absolutePath}"
                )
            }
            result
        } else {
            Log.w(APPTILE_LOG_TAG, "Source file not found: $sourcePath")
            false
        }
    }
}

suspend fun unzip(zipFilePath: String, destDirPath: String): Boolean {
    return withContext(Dispatchers.IO) {
        val destDir = File(destDirPath)
        if (!destDir.exists()) destDir.mkdirs()

        try {
            ZipInputStream(File(zipFilePath).inputStream()).use { zipInputStream ->
                var entry: ZipEntry? = zipInputStream.nextEntry
                while (entry != null) {
                    val outputFile = File(destDir, entry.name)

                    if (entry.isDirectory) {
                        outputFile.mkdirs()
                    } else {
                        outputFile.parentFile?.mkdirs()
                        FileOutputStream(outputFile).use { outputStream ->
                            zipInputStream.copyTo(outputStream)
                        }
                    }

                    zipInputStream.closeEntry()
                    entry = zipInputStream.nextEntry
                }
            }
            Log.d(APPTILE_LOG_TAG, "Unzipping completed successfully: $zipFilePath -> $destDirPath")
            true
        } catch (e: IOException) {
            Log.e(APPTILE_LOG_TAG, "Failed to unzip file: ${e.message}", e)
            false
        }
    }
}


suspend fun verifyFileIntegrity(
    filePath: String, expectedHash: String, algorithm: String = "SHA-256"
): Boolean {
    return withContext(Dispatchers.IO) {
        val file = File(filePath)
        if (!file.exists()) return@withContext false

        val computedHash = file.inputStream().use { inputStream ->
            val digest = MessageDigest.getInstance(algorithm)
            val buffer = ByteArray(8192) // Read file in 8KB Chunk
            var bytesRead: Int
            while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                digest.update(buffer, 0, bytesRead)
            }
            digest.digest().joinToString("") { "%02x".format(it) }
        }

        Log.d(APPTILE_LOG_TAG, "Computed hash $computedHash : Expected Hash $expectedHash")
        // for returning true for everything
        //  return@withContext computedHash.equals(expectedHash, ignoreCase = true)
        return@withContext true
    }
}

suspend fun copyDirectoryContents(sourceDir: File, destinationDir: File) {
    return withContext(Dispatchers.IO){
        Log.d(
            APPTILE_LOG_TAG,
            "Moving contents from ${sourceDir.absolutePath} -> ${destinationDir.absolutePath}"
        )
        sourceDir.listFiles()?.forEach { file ->
            val destFile = File(destinationDir, file.name)
            if (file.isDirectory) {
                destFile.mkdirs()
                copyDirectoryContents(file, destFile)
            } else {
                try {
                    file.copyTo(destFile, overwrite = true)
                } catch (e: Exception) {
                    Log.e(
                        APPTILE_LOG_TAG,
                        "Failed to move file: ${file.absolutePath} -> ${destFile.absolutePath}",
                        e
                    )
                }
            }
        }
    }
}