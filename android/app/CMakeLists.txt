cmake_minimum_required(VERSION 3.22.1)
set(build_DIR ${CMAKE_SOURCE_DIR}/build)

find_package(fbjni REQUIRED CONFIG)

target_link_libraries(${PACKAGE_NAME} fbjni::fbjni mylibrary)

# Include ReactNative's CMake functions
include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

# Build your application as a shared library
add_library(${APP_NAME} SHARED
    ../../../../index.js
    ../../../../App.js
    # Add any other JS files you want to include
)

# Link ReactNative libraries
target_link_libraries(${APP_NAME}
    react_codegen_${APP_NAME}
    reactnative
)