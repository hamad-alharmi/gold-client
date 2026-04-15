#include <cstring>
#include <cstdint>

#ifdef _WIN32
#include <windows.h>
#else
#include <sys/mman.h>
#endif

// Securely zero a memory region, resistant to compiler optimisation
void gc_secure_zero(void* ptr, size_t len) {
#ifdef _WIN32
    SecureZeroMemory(ptr, len);
#else
    volatile uint8_t* p = static_cast<volatile uint8_t*>(ptr);
    while (len--) *p++ = 0;
#endif
}

// Read `len` bytes from `address` in the current process (safe wrapper)
bool gc_read_memory(uintptr_t address, void* out, size_t len) {
#ifdef _WIN32
    SIZE_T read = 0;
    return ReadProcessMemory(GetCurrentProcess(),
        reinterpret_cast<LPCVOID>(address), out, len, &read) && read == len;
#else
    memcpy(out, reinterpret_cast<void*>(address), len);
    return true;
#endif
}
