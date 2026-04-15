cmake_minimum_required(VERSION 3.20)
project(GoldClientBridge VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(JNI REQUIRED)

add_library(gold_client_bridge SHARED
    src/bridge.cpp
    src/memory_ops.cpp
    src/process_hook.cpp
    src/clean_session.cpp
)

target_include_directories(gold_client_bridge PRIVATE
    ${JNI_INCLUDE_DIRS}
    include/
)

target_link_libraries(gold_client_bridge PRIVATE
    ${JNI_LIBRARIES}
)

if(CMAKE_BUILD_TYPE STREQUAL "Release")
    if(MSVC)
        target_compile_options(gold_client_bridge PRIVATE /O2 /GL)
        target_link_options(gold_client_bridge PRIVATE /LTCG)
    else()
        target_compile_options(gold_client_bridge PRIVATE -O3 -fvisibility=hidden)
        target_link_options(gold_client_bridge PRIVATE -s)
    endif()
endif()

set_target_properties(gold_client_bridge PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_SOURCE_DIR}/../launcher-core/src/main/resources/native"
    LIBRARY_OUTPUT_DIRECTORY "${CMAKE_SOURCE_DIR}/../launcher-core/src/main/resources/native"
)
