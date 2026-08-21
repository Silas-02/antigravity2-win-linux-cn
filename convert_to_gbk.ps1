$files = @(
    @{ Source = '_inst_utf8.tmp'; Target = '双击安装中文汉化.bat' },
    @{ Source = '_uninst_utf8.tmp'; Target = '双击卸载还原官方英文.bat' }
)
$gbk = [System.Text.Encoding]::GetEncoding(936)
$contents = @{}

foreach ($file in $files) {
    $sourcePath = Join-Path $PSScriptRoot $file.Source
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        throw "未找到 UTF-8 临时文件：$sourcePath"
    }
    $contents[$file.Source] = [System.IO.File]::ReadAllText($sourcePath, [System.Text.Encoding]::UTF8)
}

foreach ($file in $files) {
    $targetPath = Join-Path $PSScriptRoot $file.Target
    [System.IO.File]::WriteAllText($targetPath, $contents[$file.Source], $gbk)
}

foreach ($file in $files) {
    Remove-Item -LiteralPath (Join-Path $PSScriptRoot $file.Source) -Force
}
