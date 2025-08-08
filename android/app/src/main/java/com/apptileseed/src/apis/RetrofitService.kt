package com.apptileseed.src.apis

import com.apptileseed.src.models.ManifestResponse
import okhttp3.ResponseBody
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.Streaming
import retrofit2.http.Url

interface ApiService {
//    @GET("api/v2/app/{appId}/manifest")
//    suspend fun getManifest(@Path("appId") uuid: String): ManifestResponse

    @GET("/app/{appId}/{forkName}/manifest")
    suspend fun getManifest(
        @Path("appId") uuid: String,
        @Path("forkName") forkName: String,
        @Query("frameworkVersion") frameworkVersion: String
    ): ManifestResponse

    // since we're give complete url it don't use default base url
    @GET
    @Streaming
    suspend fun downloadFile(@Url fileUrl: String): ResponseBody

}
