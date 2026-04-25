package com.qianrenskill.app

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.qianrenskill.app.bridge.AndroidBridge
import com.qianrenskill.app.data.AppSettingsStore
import com.qianrenskill.app.data.ImportedProfileIntake
import com.qianrenskill.app.data.ProfileRepository
import com.qianrenskill.app.web.AppWebViewHost

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var profileRepository: ProfileRepository
    private lateinit var settingsStore: AppSettingsStore
    private lateinit var importedProfileIntake: ImportedProfileIntake
    private var pendingFileCallback: ValueCallback<Array<Uri>>? = null
    private val profilePickerLauncher = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        if (uri == null) {
            return@registerForActivityResult
        }
        handlePickedProfile(uri)
    }
    private val webFilePickerLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val callback = pendingFileCallback ?: return@registerForActivityResult
        pendingFileCallback = null
        val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
        callback.onReceiveValue(if (result.resultCode == Activity.RESULT_OK) uris else null)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        profileRepository = ProfileRepository(this)
        settingsStore = AppSettingsStore(this)
        importedProfileIntake = ImportedProfileIntake(this, profileRepository)
        webView = WebView(this)
        AppWebViewHost.configure(webView)
        webView.clearCache(true)
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams,
            ): Boolean {
                pendingFileCallback?.onReceiveValue(null)
                pendingFileCallback = filePathCallback

                return try {
                    val chooserIntent = fileChooserParams.createIntent().apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                    }
                    webFilePickerLauncher.launch(chooserIntent)
                    true
                } catch (_error: ActivityNotFoundException) {
                    pendingFileCallback = null
                    false
                }
            }
        }
        webView.addJavascriptInterface(
            AndroidBridge(
                this,
                settingsStore,
                profileRepository,
                { openProfilePicker() },
                { script ->
                    webView.post {
                        webView.evaluateJavascript(script, null)
                    }
                },
            ),
            "AndroidBridge",
        )
        setContentView(webView)
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    webView.evaluateJavascript(
                        "(function(){ if (window.location.hash.indexOf('#/contact-settings/') === 0) { var slug = decodeURIComponent(window.location.hash.replace('#/contact-settings/', '')); window.location.hash = '#/chat/' + encodeURIComponent(slug); return true; } if (window.location.hash.indexOf('#/chat/') === 0) { window.location.hash = '#/wechat'; return true; } return false; })();",
                    ) { handled ->
                        if (handled != "true") {
                            finish()
                        }
                    }
                }
            },
        )
        webView.loadUrl("file:///android_asset/web/index.html#/wechat")
    }

    private fun openProfilePicker() {
        profilePickerLauncher.launch(
            arrayOf("application/zip", "application/x-zip-compressed", "application/octet-stream"),
        )
    }

    private fun handlePickedProfile(uri: Uri) {
        try {
            contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        } catch (_securityError: SecurityException) {
            // Some providers do not support persistable permissions.
        }

        try {
            val imported = importedProfileIntake.importFromUri(uri)
            Toast.makeText(this, "\u5df2\u5bfc\u5165 ${imported.displayName}", Toast.LENGTH_SHORT).show()
            webView.post {
                webView.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('android-profiles-changed'));",
                    null,
                )
            }
        } catch (error: Exception) {
            Toast.makeText(
                this,
                "\u5bfc\u5165\u5931\u8d25\uff1a${error.message ?: "\u6587\u4ef6\u4e0d\u53ef\u7528"}",
                Toast.LENGTH_LONG,
            ).show()
        }
    }
}
