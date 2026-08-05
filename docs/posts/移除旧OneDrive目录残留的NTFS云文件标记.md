---
title: 移除旧 OneDrive 目录残留的 NTFS 云文件标记
date: 2026-08-06
category:
  - 编程
tag:
  - OneDrive
  - NTFS
  - PowerShell
  - Windows
---

## 前言

我以前将一个目录作为 OneDrive 同步目录使用，所有文件都保留在本地，后来停用了这个同步目录。

这些文件可以正常读取，图片、视频却只能显示默认图标，资源管理器无法生成缩略图。奇怪的是，将文件剪切到原 OneDrive 目录外，再剪切回来，缩略图就恢复了。

这并不是缩略图缓存或视频解码器的问题，而是 OneDrive 的按需文件（Files On-Demand）在 NTFS 中留下了云文件元数据（cloud file metadata）。这套机制由 Windows 的 Cloud Filter API 提供[^CloudFilterAPI]。

## 问题原因

OneDrive 的按需文件并不只靠文件属性工作。一个云文件通常同时包含两类状态：

1. 文件属性（file attributes），例如固定（pinned）、未固定（unpinned）、脱机（offline）和读取时召回（recall on data access）。
2. 重解析点（reparse point），其中保存了云文件提供程序（cloud file provider）的标识和文件身份（file identity）。

可以先用 `attrib` 查看文件属性：

```pwsh
$path = 'H:\OldOneDrive\Video\example.mp4'
cmd /c attrib "$path"
```

例如下面的 `P` 表示文件具有固定（pinned）属性：

```plaintext
A            P       H:\OldOneDrive\Video\example.mp4
```

再用 `fsutil reparsepoint`[^FsutilReparsePoint] 查看重解析点：

```pwsh
fsutil reparsepoint query "$path"
```

有问题的文件可能返回类似结果：

```plaintext
Reparse Tag Value : 0x9000601a
Tag value: Microsoft
```

`0x9000?01A` 属于 Cloud Files 使用的重解析标签（reparse tag）。即使文件正文已经完整保存在本地，Windows 外壳（Windows Shell）仍会先将它当成云占位文件（cloud placeholder）处理，并尝试找到原来的存储提供程序（storage provider）。

当原 OneDrive 账户或同步根（sync root）已经不存在时，缩略图接口可能返回：

```plaintext
0x8004B207 WTS_E_NOSTORAGEPROVIDERTHUMBNAILHANDLER
```

它的含义是找不到存储提供程序的缩略图处理器（No storage provider thumbnail handler）。因此文件可以播放或打开，但资源管理器只显示默认图标。

## 为什么只运行 `attrib` 没有效果

下面的命令只能清除文件属性：

```pwsh
cmd /c attrib -P -U -O "$path"
```

执行后，`P` 可能确实消失了，但再次运行 `fsutil reparsepoint query`，仍然可以看到 `0x9000?01A` 标签。

这是因为重解析点是独立的 NTFS 元数据，并不是 `attrib` 管理的属性位（attribute bits）。`attrib` 没有删除重解析数据的能力，执行顺序也不能改变这一点。

直接执行下面的命令通常也不行：

```pwsh
fsutil reparsepoint delete "$path"
```

Cloud Files 筛选驱动（Cloud Files minifilter，驱动名为 `CldFlt`）会阻止通用的重解析点删除操作，可能返回：

```plaintext
Error 395: Access to the cloud file is denied.
```

`395` 对应 Win32 错误 `ERROR_CLOUD_FILE_ACCESS_DENIED`[^SystemErrorCodes]。这不一定是访问控制列表（Access Control List，ACL）权限不足；即使使用管理员或 SYSTEM 权限，仍可能被 Cloud Files 自己的状态机（state machine）拒绝。

## 水合与未水合

水合（hydration）是指将云端正文下载并写入本地占位文件。完全水合（fully hydrated）的文件已经具有完整的本地数据，可以在云提供程序离线时正常读取。

未水合（unhydrated）的文件只有名称、逻辑大小（logical size）、时间戳和云端身份，部分或全部正文并不在本机。它通常是 NTFS 稀疏文件（sparse file），应用读取时会触发云文件提供程序下载正文。

可以用下面的命令辅助检查：

```pwsh
fsutil sparse queryflag "$path"

try {
    $stream = [IO.File]::OpenRead($path)
    $value = $stream.ReadByte()
    $stream.Dispose()
    "文件可读取，第一个字节：$value"
}
catch {
    "读取失败：$($_.Exception.Message)"
}
```

如果原云文件提供程序已经不可用，未水合文件可能返回[^SystemErrorCodes]：

```plaintext
0x8007016A ERROR_CLOUD_FILE_PROVIDER_NOT_RUNNING
```

这时不能安全地强行删除云标签。因为正文根本不在本地，去掉占位元数据只会留下逻辑大小看似正常、实际数据缺失的损坏文件。应先重新连接原云盘并完成水合，或者确认文件不再需要后删除它。

## 方法一：移出旧同步根再移回

对于少量文件，最简单的方法是将文件移动到旧 OneDrive 同步根之外，再移动回来。

> [!IMPORTANT]
> 临时目录应与原文件位于同一个 NTFS 卷。例如原文件在 `H:`，临时目录也应放在 `H:`。同卷移动只是修改 NTFS 目录项，不会复制文件正文；跨卷移动会退化为复制后删除，大文件会产生大量读写。

下面的示例会记录哈希（hash）和 NTFS 文件 ID（file ID），移动文件后再核对：

```pwsh
$source = 'H:\OldOneDrive\Video\example.mp4'
$originalDirectory = Split-Path -LiteralPath $source
$temporaryDirectory = 'H:\OneDriveRepairTemp'
$temporaryPath = Join-Path $temporaryDirectory (Split-Path -Leaf $source)

New-Item -ItemType Directory -Path $temporaryDirectory -Force | Out-Null

$hashBefore = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
$idBefore = fsutil file queryFileID "$source"

# 同卷移动：文件正文不会被复制
Move-Item -LiteralPath $source -Destination $temporaryPath

fsutil reparsepoint query "$temporaryPath"

Move-Item -LiteralPath $temporaryPath -Destination $source

# 清除移动后可能残留的云属性
cmd /c attrib -P -U -O "$source"

$hashAfter = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
$idAfter = fsutil file queryFileID "$source"

[pscustomobject]@{
    HashMatch = $hashBefore -eq $hashAfter
    FileIdBefore = $idBefore
    FileIdAfter = $idAfter
}
```

文件跨出旧同步根时，`CldFlt` 会将已经完整水合的占位文件还原为普通文件。由于这个目录已经不再注册为 OneDrive 同步根，文件移回后不会重新获得云标签。

在我的测试中，移出和移回前后的文件 ID 与 SHA-256 均完全相同，`0x9000601A` 标签在移出时消失，缩略图立即恢复。这证明同卷移动没有复制正文。

这种方法适合手动修复少量文件，但不适合数万个文件，也不建议直接移动整个旧同步根目录：同步根本身可能也具有云重解析标签，移动它未必形成预期的“跨出同步根”行为。

## 方法二：使用 `CfRevertPlaceholder` 原地修复

Windows 提供了专门的 Cloud Files API：`CfRevertPlaceholder`[^CfRevertPlaceholder]。它用于将已经水合的占位文件或目录原地还原（in-place revert）为普通文件或目录，不需要复制、移动、重命名或删除文件。

该 API 接受属性句柄或无访问权限句柄，但调用者本身必须对目标具有 `WRITE_DATA` 或 `WRITE_DAC` 权限。普通用户拥有自己文件的写入权限时即可调用，不需要管理员或 SYSTEM 权限。

下面的 PowerShell 脚本会：

1. 使用 `CfGetPlaceholderInfo`[^CfGetPlaceholderInfo] 判断路径是否为 Cloud Files 占位文件。
2. 对占位文件调用 `CfRevertPlaceholder`。
3. 清除 `Pinned`、`Unpinned`、`Offline` 和 `Recall` 属性位。
4. 先处理文件，再按路径深度从深到浅处理目录，最后处理同步根。
5. 保留无法水合或没有权限的文件，并输出失败列表。

> [!WARNING]
> 若要直接使用该脚本，请先在小范围文件内尝试，以免造成不可逆的后果

```pwsh
param(
    [Parameter(Mandatory)]
    [string] $Root
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$normalResults = @(
    [Convert]::ToUInt32('80070001', 16), # ERROR_INVALID_FUNCTION
    [Convert]::ToUInt32('80070178', 16), # ERROR_NOT_A_CLOUD_FILE
    [Convert]::ToUInt32('80070186', 16), # ERROR_CLOUD_FILE_NOT_UNDER_SYNC_ROOT
    [Convert]::ToUInt32('80071126', 16)  # ERROR_NOT_A_REPARSE_POINT
)

Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

public static class CloudFileRepair
{
    private const uint ShareAll = 0x7;
    private const uint OpenExisting = 3;
    private const uint OpenReparsePoint = 0x00200000;
    private const uint BackupSemantics = 0x02000000;
    private const uint InvalidAttributes = 0xFFFFFFFF;

    // OFFLINE | RECALL_ON_OPEN | PINNED | UNPINNED | RECALL_ON_DATA_ACCESS
    private const uint CloudAttributeMask = 0x005C1000;
    private const uint DirectoryAttribute = 0x00000010;
    private const uint NormalAttribute = 0x00000080;

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern SafeFileHandle CreateFileW(
        string fileName,
        uint desiredAccess,
        uint shareMode,
        IntPtr securityAttributes,
        uint creationDisposition,
        uint flagsAndAttributes,
        IntPtr templateFile);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern uint GetFileAttributesW(string fileName);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetFileAttributesW(
        string fileName,
        uint fileAttributes);

    [DllImport("cldapi.dll")]
    private static extern int CfGetPlaceholderInfo(
        SafeFileHandle fileHandle,
        int infoClass,
        IntPtr infoBuffer,
        uint infoBufferLength,
        out uint returnedLength);

    [DllImport("cldapi.dll")]
    private static extern int CfRevertPlaceholder(
        SafeFileHandle fileHandle,
        uint revertFlags,
        IntPtr overlapped);

    private static string GetExtendedPath(string path)
    {
        if (path.StartsWith(@"\\?\", StringComparison.Ordinal))
            return path;
        if (path.StartsWith(@"\\", StringComparison.Ordinal))
            return @"\\?\UNC\" + path.Substring(2);
        return @"\\?\" + path;
    }

    private static uint HResultFromWin32(int error)
    {
        if (error <= 0)
            return unchecked((uint)error);
        return 0x80070000U | ((uint)error & 0xFFFFU);
    }

    private static SafeFileHandle OpenMetadataHandle(string path)
    {
        return CreateFileW(
            GetExtendedPath(path),
            0,
            ShareAll,
            IntPtr.Zero,
            OpenExisting,
            OpenReparsePoint | BackupSemantics,
            IntPtr.Zero);
    }

    public static uint Probe(string path)
    {
        using SafeFileHandle handle = OpenMetadataHandle(path);
        if (handle.IsInvalid)
            return HResultFromWin32(Marshal.GetLastWin32Error());

        IntPtr buffer = Marshal.AllocHGlobal(65536);
        try
        {
            uint returnedLength;
            int result = CfGetPlaceholderInfo(
                handle, 0, buffer, 65536, out returnedLength);
            return unchecked((uint)result);
        }
        finally
        {
            Marshal.FreeHGlobal(buffer);
        }
    }

    public static uint Revert(string path)
    {
        using SafeFileHandle handle = OpenMetadataHandle(path);
        if (handle.IsInvalid)
            return HResultFromWin32(Marshal.GetLastWin32Error());

        return unchecked((uint)CfRevertPlaceholder(
            handle, 0, IntPtr.Zero));
    }

    public static bool ClearCloudAttributes(string path)
    {
        string extendedPath = GetExtendedPath(path);
        uint attributes = GetFileAttributesW(extendedPath);
        if (attributes == InvalidAttributes)
            throw new Win32Exception(Marshal.GetLastWin32Error());

        if ((attributes & CloudAttributeMask) == 0)
            return false;

        uint cleanAttributes = attributes & ~CloudAttributeMask;
        if ((cleanAttributes & DirectoryAttribute) == 0 &&
            cleanAttributes == 0)
            cleanAttributes = NormalAttribute;

        if (!SetFileAttributesW(extendedPath, cleanAttributes))
            throw new Win32Exception(Marshal.GetLastWin32Error());

        return true;
    }
}
'@

$failures = [Collections.Generic.List[object]]::new()
$reverted = 0
$attributesCleared = 0

function Repair-Path {
    param(
        [string] $Kind,
        [string] $Path
    )

    $probe = [CloudFileRepair]::Probe($Path)

    if ($probe -eq 0) {
        $result = [CloudFileRepair]::Revert($Path)
        if ($result -ne 0) {
            $script:failures.Add([pscustomobject]@{
                Kind = $Kind
                Path = $Path
                Operation = 'CfRevertPlaceholder'
                HResult = '0x{0:X8}' -f $result
            })
            return
        }
        $script:reverted++
    }
    elseif ($normalResults -notcontains $probe) {
        $script:failures.Add([pscustomobject]@{
            Kind = $Kind
            Path = $Path
            Operation = 'CfGetPlaceholderInfo'
            HResult = '0x{0:X8}' -f $probe
        })
        return
    }

    if ([CloudFileRepair]::ClearCloudAttributes($Path)) {
        $script:attributesCleared++
    }
}

$rootItem = Get-Item -LiteralPath $Root -Force
$files = @(Get-ChildItem -LiteralPath $Root -File -Recurse -Force)
$directories = @(
    @(Get-ChildItem -LiteralPath $Root -Directory -Recurse -Force) +
        @($rootItem) |
        Sort-Object { $_.FullName.Length } -Descending
)

foreach ($file in $files) {
    Repair-Path -Kind File -Path $file.FullName
}

foreach ($directory in $directories) {
    Repair-Path -Kind Directory -Path $directory.FullName
}

"撤销占位符：$reverted"
"清除云属性：$attributesCleared"

if ($failures.Count -gt 0) {
    $failurePath = Join-Path $PWD 'OneDrive-repair-failures.csv'
    $failures | Export-Csv -LiteralPath $failurePath `
        -NoTypeInformation -Encoding utf8BOM
    "未处理项目：$($failures.Count)，详情：$failurePath"
}
```

保存为 `Remove-OneDriveMetadata.ps1` 后，在 PowerShell 7 中运行：

```pwsh
.\Remove-OneDriveMetadata.ps1 -Root 'H:\OldOneDrive'
```

该脚本不会读取或重写文件正文，也没有复制、移动、重命名和删除操作。对于已经完全水合的文件，文件 ID 与内容均保持不变。

## 修复后验证

可以抽查几个文件和根目录：

```pwsh
$paths = @(
    'H:\OldOneDrive',
    'H:\OldOneDrive\Video\example.mp4',
    'H:\OldOneDrive\Archive\example.zip'
)

foreach ($path in $paths) {
    cmd /c attrib "$path"
    fsutil reparsepoint query "$path"
}
```

正常文件会显示：

```plaintext
Error 4390: The file or directory is not a reparse point.
```

还可以检查是否仍有云属性：

```pwsh
$cloudAttributeMask = 0x005C1000

@(
    Get-Item -LiteralPath 'H:\OldOneDrive' -Force
    Get-ChildItem -LiteralPath 'H:\OldOneDrive' -Recurse -Force
) | Where-Object {
    (([uint32]$_.Attributes) -band $cloudAttributeMask) -ne 0
} | Select-Object FullName, Length, Attributes
```

如果这里只剩少量稀疏、无法读取的文件，并且失败列表中出现 `ERROR_CLOUD_FILE_PROVIDER_NOT_RUNNING`，它们就是未水合文件。不要直接清除其重解析点。

## 本地不存在文件正文时的处理

批量修复前应先确认文件可以完整读取。对于未完全水合的占位文件，`CfRevertPlaceholder` 会请求原同步提供程序取回缺失的正文；如果无法水合，撤销操作就会失败[^CfRevertPlaceholder]。

此时不要强行删除重解析点，也不要把管理员或 SYSTEM 权限当成解决办法。权限可以解决 ACL 拒绝，却不能恢复本机不存在的文件正文。应重新连接原云盘并完成水合，或者从备份恢复；如果已经确认文件不再需要，直接删除该占位文件即可。

[^CloudFilterAPI]: [Cloud Filter API](https://learn.microsoft.com/windows/win32/cfapi/cloud-files-api-portal)

[^FsutilReparsePoint]: [fsutil reparsepoint](https://learn.microsoft.com/windows-server/administration/windows-commands/fsutil-reparsepoint)

[^SystemErrorCodes]: [System Error Codes (0-499)](https://learn.microsoft.com/windows/win32/debug/system-error-codes--0-499-)

[^CfRevertPlaceholder]: [CfRevertPlaceholder function (cfapi.h)](https://learn.microsoft.com/windows/win32/api/cfapi/nf-cfapi-cfrevertplaceholder)

[^CfGetPlaceholderInfo]: [CfGetPlaceholderInfo function (cfapi.h)](https://learn.microsoft.com/windows/win32/api/cfapi/nf-cfapi-cfgetplaceholderinfo)
