require 'net/http'
require 'json'
require 'fileutils'
require 'yaml'

def create_directory(dirname)
  unless Dir.exists?(dirname)
    FileUtils.mkdir_p(dirname)
  end
end

def http_download_uri(uri, filename, token, locale, downloadPath)
  http_object = Net::HTTP.new(uri.host, uri.port)
  http_object.use_ssl = true if uri.scheme == 'https'
  begin
    http_object.start do |http|
      request = Net::HTTP::Get.new uri.request_uri
      http.read_timeout = 500
      http.request request do |response|
        open filename, 'w' do |io|
          response.read_body do |chunk|
            io.write chunk
          end
        end
      end
    end
  rescue Exception => e
    puts "\e[31m#{"=> Exception: '#{e}'. Skipping download."}\e[0m"
    return
  end
  puts "\e[32m#{"Downloaded " + locale + " to " + downloadPath}\e[0m"
end

config = YAML.load(File.read(".translized.yml"))
projectId = config[:translized][:project_id]
token = config[:translized][:access_token]
downloadConfig = config[:translized][:download]

if projectId.nil?
  puts "\e[31m#{"Please input project_id in .translized.yml file"}\e[0m"
  return
end
if token.nil?
  puts "\e[31m#{"Please input access_token in .translized.yml file"}\e[0m"
  return
end

if !downloadConfig.kind_of?(Array)
  downloadConfig = [downloadConfig]
end

script_dir = Dir.pwd

for download in downloadConfig do
  fileFormat = download[:file_format]
  downloadPath = download[:path]
  isNested = download["isNested"] || false
  downloadOptions = download["options"]
  tagsString = download[:tags]
  tags = nil
  if !tagsString.nil?
    tags = tagsString.split(',').map(&:strip)
  end

  if fileFormat.nil?
    puts "\e[31m#{"Please input file_format in .translized.yml file"}\e[0m"
    return
  end
  if downloadPath.nil?
    puts "\e[31m#{"Please input download path in .translized.yml file"}\e[0m"
    return
  end
  uri = URI("https://api.translized.com/project/exportAll")
  request = Net::HTTP::Post.new(uri)
  request.add_field("Content-Type", "application/json")
  request.add_field("api-token", token)
  body = {projectId: projectId, exportFormat: fileFormat, isNested: isNested, tags: tags};
  unless downloadOptions.nil?
    unless downloadOptions["replace_empty"].nil?
      replace_empty = downloadOptions["replace_empty"]
      if replace_empty[:primary_translations] == true then
        body["replaceEmptyWithPrimaryTranslations"] = true
      end
      if replace_empty[:pseudolocalization] == true then
        increase_percentage = replace_empty[:increase_percentage]
        if increase_percentage.nil?
          puts "\e[31m#{"Please input increase_percentage in .translized.yml file"}\e[0m"
          return
        end
        body["replaceEmptyWithPseudolocalization"] = {"increasePercentage": increase_percentage}
      end
    end
    unless downloadOptions["transform_placeholders_iOS_android"].nil?
      if downloadOptions["transform_placeholders_iOS_android"] == true then
        body["transformPlaceholdersiOSAndroid"] = true
      end
    end
  end

  request.body = body.to_json

  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true
  response = http.request(request)

  jsonResponse = JSON.parse(response.body)
  if response.code == "200" then
    jsonResponse["result"].each { |language|
      locale, url = language.first
      uriLocale = URI(url["fileURL"])
      dirname = File.dirname(downloadPath).gsub('<locale_code>', locale)
      filename = File.basename(downloadPath).gsub('<locale_code>', locale)
      # android
      if fileFormat == 'xml' && locale == "en" then 
        dirname = dirname.gsub('-' + locale, '')
      end
      Dir.chdir script_dir
      if dirname
        create_directory(dirname)
        Dir.chdir dirname
      end
      http_download_uri(uriLocale, filename, token, locale, dirname + "/" + filename)
    }
  elsif response.code != "200"
    puts "\e[31m#{jsonResponse["error"]}\e[0m"
  end
end
