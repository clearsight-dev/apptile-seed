#!/usr/bin/env ruby

require 'json'

# Read version from apptile.config.json
config_path = '../apptile.config.json'
if File.exist?(config_path)
  config = JSON.parse(File.read(config_path))
  app_version = config.dig('ios', 'version') || '1.0.0'
  build_number = config.dig('ios', 'build_number') || '1'
else
  # Default values if config file not found
  app_version = '1.0.0'
  build_number = '1'
end

# Update project.pbxproj
project_path = 'apptileSeed.xcodeproj/project.pbxproj'
if File.exist?(project_path)
  # Read file
  content = File.read(project_path)
  
  # Replace versions
  updated_content = content.gsub(/CURRENT_PROJECT_VERSION = \d+/, "CURRENT_PROJECT_VERSION = #{build_number}")
  updated_content = updated_content.gsub(/MARKETING_VERSION = [^;]+;/, "MARKETING_VERSION = #{app_version};")
  
  # Write updated content
  File.write(project_path, updated_content)
  
  # Update Info.plist files
  ["apptileSeed/Info.plist", "ImageNotification/Info.plist", "NotificationContentExtension/Info.plist"].each do |plist_path|
    if File.exist?(plist_path)
      system("plutil -replace CFBundleVersion -string #{build_number} #{plist_path}")
      system("plutil -replace CFBundleShortVersionString -string #{app_version} #{plist_path}")
    end
  end
  
  puts "Updated to version #{app_version} (#{build_number})"
else
  puts "Error: #{project_path} not found"
end

puts "Version update completed"
