#include <cstring>
#include <cstdlib>

#ifdef _WIN32
#include <windows.h>
#include <psapi.h>
#else
#include <dlfcn.h>
#include <unistd.h>
#endif

// Zero-out a heap string and free it
static void secure_free(char* ptr, size_t len) {
    if (!ptr) return;
    volatile char* p = ptr;
    while (len--) *p++ = '\0';
    free(ptr);
}

// Wipe temp files written by the launcher session
static void wipe_temp_files() {
#ifdef _WIN32
    char tmp[MAX_PATH];
    GetTempPathA(MAX_PATH, tmp);
    // Walk %TEMP%\GoldClient* and delete
    WIN32_FIND_DATAA fd;
    char pattern[MAX_PATH];
    snprintf(pattern, MAX_PATH, "%sGoldClient*", tmp);
    HANDLE h = FindFirstFileA(pattern, &fd);
    if (h != INVALID_HANDLE_VALUE) {
        do {
            char full[MAX_PATH];
            snprintf(full, MAX_PATH, "%s%s", tmp, fd.cFileName);
            DeleteFileA(full);
        } while (FindNextFileA(h, &fd));
        FindClose(h);
    }
#else
    system("rm -f /tmp/GoldClient* 2>/dev/null");
#endif
}

#ifdef _WIN32
// Flush prefetch hints for this process image
static void flush_prefetch() {
    // Prefetch files live at C:\Windows\Prefetch\<EXE>-*.pf
    // Requires elevation; silently skip if denied
    char path[MAX_PATH];
    GetWindowsDirectoryA(path, MAX_PATH);
    strncat(path, "\\Prefetch\\GOLDCLIENT*", MAX_PATH - strlen(path) - 1);
    WIN32_FIND_DATAA fd;
    HANDLE h = FindFirstFileA(path, &fd);
    if (h != INVALID_HANDLE_VALUE) {
        char windir[MAX_PATH];
        GetWindowsDirectoryA(windir, MAX_PATH);
        do {
            char full[MAX_PATH];
            snprintf(full, MAX_PATH, "%s\\Prefetch\\%s", windir, fd.cFileName);
            DeleteFileA(full);
        } while (FindNextFileA(h, &fd));
        FindClose(h);
    }
}
#endif

extern "C" void gc_clean_session() {
    wipe_temp_files();
#ifdef _WIN32
    flush_prefetch();
#endif
    // Native libs are unloaded when the JVM exits;
    // FreeLibrary on our own handle would crash — let the OS reclaim handles.
}
