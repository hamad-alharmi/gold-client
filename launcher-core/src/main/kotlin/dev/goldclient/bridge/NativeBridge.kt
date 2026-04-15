package dev.goldclient.bridge

object NativeBridge {
    init {
        System.loadLibrary("gold_client_bridge")
    }

    external fun getVersion(): String
    external fun cleanSession()
}
