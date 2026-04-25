package com.qianrenskill.app.web

import android.webkit.WebSettings
import android.webkit.WebView

object AppWebViewHost {
    fun configure(webView: WebView) {
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = true
        webView.settings.allowFileAccessFromFileURLs = true
        webView.settings.allowUniversalAccessFromFileURLs = true
        webView.settings.allowContentAccess = false
        webView.settings.cacheMode = WebSettings.LOAD_NO_CACHE
    }
}
