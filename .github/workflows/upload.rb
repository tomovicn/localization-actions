require 'net/http'
require 'json'
require 'fileutils'
require 'yaml'

config = YAML.load(File.read(".translized.yml"))
projectId = config[:translized][:project_id]
token = config[:translized][:access_token]

uploadConfig = config[:translized][:upload]

if !uploadConfig.kind_of?(Array)
  uploadConfig = [uploadConfig]
end

for upload in uploadConfig do
path = upload[:path]
language = upload[:language_code]
isNested = upload["isNested"] || false

if projectId.nil?
  puts "\e[31m#{"Please input project_id in .translized.yml file"}\e[0m"
  return
end
if token.nil?
  puts "\e[31m#{"Please input access_token in .translized.yml file"}\e[0m"
  return
end
if path.nil?
  puts "\e[31m#{"Please input upload file path in .translized.yml file"}\e[0m"
  return
end
if !(path.include? "<locale_code>") && language.nil?
    puts "\e[31m#{"Please input language code of upload file for path " + path + " in .translized.yml file (key: language_code)"}\e[0m"
    return
end

tags = upload[:tags] || {}
newKeysTagsString = tags[:new_keys]
updatedKeysTagsString = tags[:updated_keys]
overrideTranslations = upload[:update_translations] == true
newKeysTags = []
if !newKeysTagsString.nil?
  newKeysTags = newKeysTagsString.split(',').map(&:strip)
end
updatedKeysTags = []
if !updatedKeysTagsString.nil?
  updatedKeysTags = updatedKeysTagsString.split(',').map(&:strip)
  if !overrideTranslations then
    puts "\e[31m#{"update_translations parameter in .translized.yml must be set to true so that updated keys can be tagged"}\e[0m"
    return
  end
end

filePaths = [{"filePath": path, "languageCode": language}]
if path.include? "<locale_code>"
  splitedArray = path.split("<locale_code>")
  filePaths = Dir.glob("**/*")
  .select { |path| path.start_with?(splitedArray.first.delete_prefix("./")) && path.end_with?(splitedArray.last) }
  .map { |path| {"filePath": path, "languageCode": path.delete_prefix(splitedArray.first.delete_prefix("./")).delete_suffix(splitedArray.last) } }
end


for fileObj in filePaths do
filePath = fileObj[:filePath]
languageCode = fileObj[:languageCode]

uri = URI("https://api.translized.com/upload/" + File.basename(filePath))
request = Net::HTTP::Post.new(uri)
request["Content-Type"] = "text/" + File.extname(filePath).delete('.')
request.body = ""
request.body << File.read(filePath)

http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true
response = http.request(request)

jsonResponse = JSON.parse(response.body)
if response.code == "201" then
  puts "Uploaded file: " + filePath
  puts "Importing translations..."
  puts ""

  uriImport = URI("https://api.translized.com/import")
  requestImport = Net::HTTP::Post.new(uriImport)
  requestImport.add_field("Content-Type", "application/json")
  requestImport.add_field("api-token", token)
  body = {projectId: projectId, languageCode: languageCode, fileURL: jsonResponse["url"], isNested: isNested}
  body["overrideTranslations"] = overrideTranslations
  unless newKeysTags.empty? && updatedKeysTags.empty?
    processingRules = {
      "overrideImportAutomations": true,
      "newKeys": !newKeysTags.empty? ? {"tags": newKeysTags} : {},
      "updatedKeys": !updatedKeysTags.empty? ? {"tags": updatedKeysTags} : {}
    } 
    body["processingRules"] = processingRules
  end
  requestImport.body = body.to_json

  httpImport = Net::HTTP.new(uriImport.host, uriImport.port)
  httpImport.use_ssl = true
  responseImport = httpImport.request(requestImport)
  jsonResponseImport = JSON.parse(responseImport.body)
  if responseImport.code == "200" then
    puts "\e[32m#{"Total parsed: " + jsonResponseImport["result"]["totalParsed"].to_s}\e[0m"
    puts "\e[32m#{"Total added: " + jsonResponseImport["result"]["totalAdded"].to_s}\e[0m"
    puts "\e[32m#{"Total updated: " + jsonResponseImport["result"]["totalUpdated"].to_s}\e[0m"
    puts ""
  elsif responseImport.code != "200"
    puts puts "\e[31m#{jsonResponseImport["error"]}\e[0m"
  end

elsif response.code != "201"
  puts puts "\e[31m#{jsonResponse["error"]}\e[0m"
end
end
end
