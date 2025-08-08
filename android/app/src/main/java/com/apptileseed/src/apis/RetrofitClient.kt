package com.apptileseed.src.apis

import android.content.Context

import com.apptileseed.R
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory


object RetrofitClient {
    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BASIC
    }

    private val httpClient = OkHttpClient.Builder()
        .addInterceptor(loggingInterceptor)
        .build()

    private fun createRetrofit(baseUrl: String): Retrofit {
        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .addConverterFactory(GsonConverterFactory.create())
            .client(httpClient)
            .build()
    }

    fun <T> createService(baseUrl: String, serviceClass: Class<T>): T {
        return createRetrofit(baseUrl).create(serviceClass)
    }
}


object ApptileApiClient {
    @Volatile
    private var serviceInstance: ApiService? = null

    fun init(context: Context) {
        if (serviceInstance == null) {
            synchronized(this) {
                if (serviceInstance == null) {
                    serviceInstance = RetrofitClient.createService(context.getString(R.string.APPTILE_UPDATE_ENDPOINT), ApiService::class.java)
//                    serviceInstance = RetrofitClient.createService(context.getString(R.string.APPTILE_API_ENDPOINT), ApiService::class.java)
                }
            }
        }
    }

    val service: ApiService
        get() = serviceInstance ?: throw IllegalStateException("Apptile Api Client is not initialized. Call init(context) first.")
}
