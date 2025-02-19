---
title: 让Visual Studio的终端拥有命令补全（PSReadLine）
date: 2025-02-13
category:
  - 编程
tag:
  - VisualStudio
  - PowerShell
  - Windows
---
如果你下载了Windows Terminal和最新版的PowerShell Core就会发现，
如果不特殊设置的话，即使我们使用的Windows Terminal拥有命令补全，Visual Studio的终端仍然没有任何补全。

这是因为Visual Studio的终端使用的是系统自带的Windows PowerShell的模块（Modules），而不是Windows Terminal的模块，
所以看起来会有不同。

而命令补全功能是由一个名为`PSReadLine`的模块提供的，Windows PowerShell中只有老版本v2.0.0，而Windows Terminal中是最新的版本。
我们可以用`Get-Module -ListAvailable`看到这种情况：

```pwsh
PS C:\Users\poker> Get-Module -ListAvailable

...

    Directory: C:\program files\windowsapps\microsoft.powershell_7.5.0.0_x64__8wekyb3d8bbwe\Modules

ModuleType Version    PreRelease Name       ...
---------- -------    ---------- ----       ...
Script     2.3.6                 PSReadLine ...
...

    Directory: C:\Program Files\WindowsPowerShell\Modules

ModuleType Version    PreRelease Name       ...
---------- -------    ---------- ----       ...
Script     2.0.0                 PSReadLine ...
...
```

既然是老版本，升级模块应该就可以了吧？然而它会报错：

```pwsh
PS C:\Users\poker> Update-Module PSReadLine
Update-Module: Module 'PSReadLine' was not installed by using Install-Module, so it cannot be updated.
```

## 解决方法

通过尝试我找到了一种简单的解决方法：直接覆盖新的模块。

首先，如果Windows Terminal中也没有最新版的`PSReadLine`的话，可以运行`Install-Module PSReadLine`安装最新版本。
安装过程中若有需要信任或同意的选项，信任/同意即可。

然后根据刚刚`Get-Module -ListAvailable`输出的路径，一般来说是：

- Windows Terminal模块路径

    ```plaintext
    C:\program files\windowsapps\microsoft.powershell_7.5.0.0_x64__8wekyb3d8bbwe\Modules
    ```

- Windows PowerShell模块路径

    ```plaintext
    C:\Program Files\WindowsPowerShell\Modules
    ```

分别打开之后，先关闭所有PowerShell窗口，包括并不限于Visual Studio中的。

然后删除Windows PowerShell路径下的`PSReadLine`文件夹，再将Windows Terminal路径下的`PSReadLine`文件夹复制过来即可。

最后再次打开Visual Studio的终端，可以发现已经支持命令补全了。

## 注意

不要用此方法更新其他模块，尤其是`PowerShellGet`、`PackageManagement`。
因为Windows PowerShell版本较老，可能不支持新版的模块，但目前`PSReadLine`还没有发现不支持的情况。
