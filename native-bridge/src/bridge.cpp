#include <jni.h>
#include <cstring>
#include <cstdlib>

// JNI entry point — called from Kotlin via System.loadLibrary("gold_client_bridge")
extern "C" {

JNIEXPORT jstring JNICALL
Java_dev_goldclient_bridge_NativeBridge_getVersion(JNIEnv* env, jobject) {
    return env->NewStringUTF("GoldClient-Bridge/1.0");
}

JNIEXPORT void JNICALL
Java_dev_goldclient_bridge_NativeBridge_cleanSession(JNIEnv* env, jobject) {
    // Delegated to clean_session.cpp
    extern void gc_clean_session();
    gc_clean_session();
}

} // extern "C"
