#include <cstdint>
#include <cstring>

#ifdef _WIN32
#include <windows.h>

// Minimal detour hook — redirects `target` to `hook`, saves original bytes
struct Hook {
    uint8_t original[14];
    void*   target;
    bool    installed;
};

static Hook g_hooks[32];
static int  g_hook_count = 0;

bool gc_install_hook(void* target, void* hook) {
    if (g_hook_count >= 32) return false;
    Hook& h = g_hooks[g_hook_count++];
    h.target    = target;
    h.installed = false;

    DWORD old;
    if (!VirtualProtect(target, 14, PAGE_EXECUTE_READWRITE, &old))
        return false;

    memcpy(h.original, target, 14);

    // x64 absolute jmp: FF 25 00 00 00 00 <8-byte addr>
    uint8_t patch[14] = { 0xFF, 0x25, 0x00, 0x00, 0x00, 0x00 };
    memcpy(patch + 6, &hook, 8);
    memcpy(target, patch, 14);

    VirtualProtect(target, 14, old, &old);
    h.installed = true;
    return true;
}

void gc_remove_all_hooks() {
    for (int i = 0; i < g_hook_count; i++) {
        Hook& h = g_hooks[i];
        if (!h.installed) continue;
        DWORD old;
        VirtualProtect(h.target, 14, PAGE_EXECUTE_READWRITE, &old);
        memcpy(h.target, h.original, 14);
        VirtualProtect(h.target, 14, old, &old);
    }
    g_hook_count = 0;
}

#else
// Stub for non-Windows builds
bool gc_install_hook(void*, void*) { return false; }
void gc_remove_all_hooks() {}
#endif
