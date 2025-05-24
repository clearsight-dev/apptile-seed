package com.apptileseed.src.models

data class CodeArtefact(
    val id: Long, val type: String, val cdnlink: String, val tag: String
)

data class ManifestResponse(
    val id: Int,
    val appId: Int,
    val frameworkVersion: String,
    val forkName: String,
    val title: String,
    val publishedCommitId: Long,
    val createdAt: String,
    val updatedAt: String,
    val deletedAt: String?,
    val url: String,
    val artefacts: List<CodeArtefact>
)
