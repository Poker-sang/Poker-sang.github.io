---
title: 使用PowerShell通过不同网络（网卡）访问不同网站
date: 2022-03-26
categories: 编程
tags:
- PowerShell
- 网络
- Windows
---
## 前言

在学校生活时经常有一种需求：访问某些网站（如校内系统）时需要使用校园网，访问另一些网站（如Steam、Github等）校园网很慢，需要使用手机浏览器等其他网络加速。此时我就觉得如果能同时使用两个网络该多好。

本文就介绍如何用PowerShell实现这个功能（需要Windows平台，版本XP及以上）。

## 原理

首先需要明确，同一张网卡是无法同时连接两个网络的（除非同时使用多个代理达到这种效果）。幸运的是，现在绝大多数电脑都同时拥有有线和无线两张网卡，所以可以实现这个效果。

其次，一般应用程序无法直接指定网卡上网（例如虚拟机软件除外），不过我们有代替的方法：设置路由表。

路由表的基本原理是：要求IP的某些网段，走指定的网关。而网关又和网络有密不可分的联系，从而实现隐式地指定网卡。

## 查看电脑信息

首先可以同时连上有线和无线网，方便查看

### 网络适配器

一台电脑上会有多个网络适配器，其中有物理网卡，也有虚拟网卡。我们要找出其中物理网卡里的有线和无线网卡：首先键入`ipconfig`，可以对此有一个大致印象：

十分明显地看到，有好多适配器。但比如说名字里带virtual的，或者vEthernet这种显然是虚拟网卡。剩下很快就能发现有线和无线网络适配器分别是：以太网和WLAN（不同电脑可能名字不一样，连接状态也不尽相同）。

```plaintext
PS C:\Users\poker> ipconfig

Windows IP 配置


以太网适配器 以太网:

   连接特定的 DNS 后缀 . . . . . . . : hgd
   本地链接 IPv6 地址. . . . . . . . : XXXX::XXXX:XXXX:XXXX:XXXX%XX
   IPv4 地址 . . . . . . . . . . . . : XXX.XXX.XXX.XXX
   子网掩码  . . . . . . . . . . . . : XXX.XXX.XXX.XXX
   默认网关. . . . . . . . . . . . . : XXX.XXX.XXX.XXX

无线局域网适配器 本地连接* 5:

   媒体状态  . . . . . . . . . . . . : 媒体已断开连接
   连接特定的 DNS 后缀 . . . . . . . :

无线局域网适配器 本地连接* 6:

   媒体状态  . . . . . . . . . . . . : 媒体已断开连接
   连接特定的 DNS 后缀 . . . . . . . :

无线局域网适配器 WLAN:

   连接特定的 DNS 后缀 . . . . . . . :
   本地链接 IPv6 地址. . . . . . . . : XXXX::XXXX:XXXX:XXXX:XXXX%XX
   IPv4 地址 . . . . . . . . . . . . : XXX.XXX.XXX.XXX
   子网掩码  . . . . . . . . . . . . : XXX.XXX.XXX.XXX
   默认网关. . . . . . . . . . . . . : XXX.XXX.XXX.XXX

以太网适配器 蓝牙网络连接 3:

   媒体状态  . . . . . . . . . . . . : 媒体已断开连接
   连接特定的 DNS 后缀 . . . . . . . :
```

接下来使用`Get-NetIPConfiguration`指令，就可以看到物理网卡的信息了：

其中我们要注意Gateway的项，这就是网关。

```plaintext
PS C:\Users\poker> Get-NetIPConfiguration

InterfaceAlias       : 以太网
InterfaceIndex       : 18
InterfaceDescription : Realtek PCIe GbE Family Controller
NetProfile.Name      : XXXXXXXXXXXXXXX
IPv4Address          : XXX.XXX.XXX.XXX
IPv6DefaultGateway   :
IPv4DefaultGateway   : XXX.XXX.XXX.XXX
DNSServer            : XXX.XXX.XXX.XXX
                       XXX.XXX.XXX.XXX
                       XXX.XXX.XXX.XXX
                       XXX.XXX.XXX.XXX
                       XXX.XXX.XXX.XXX
                       XXX.XXX.XXX.XXX

InterfaceAlias       : WLAN
InterfaceIndex       : 14
InterfaceDescription : Intel(R) Wi-Fi 6 AX200 160MHz
NetProfile.Name      : XXXXXXXXXXXXXXX
IPv4Address          : XXX.XXX.XXX.XXX
IPv6DefaultGateway   :
IPv4DefaultGateway   : XXX.XXX.XXX.XXX
DNSServer            : XXX.XXX.XXX.XXX

InterfaceAlias       : 蓝牙网络连接 3
InterfaceIndex       : 10
InterfaceDescription : Bluetooth Device (Personal Area Network) #3
NetAdapter.Status    : Disconnected
```

其他相关指令：`netsh interface show interface`、`Get-NetAdapter`，感兴趣可以看看。

### 路由

使用`Get-NetRoute`指令（或`route print`）可以查看路由表：

表中每一条代表一个路由，注意他所有的属性：

* `ifIndex` (interface index)（接口序号）：即和上图同名的属性。

* `DestinationPrefix`（目标前缀）：即指定的网段，属于这个网段的会找对应的网关（其中前面四段句点分开的是IP，斜杠后的是子网掩码从左往右数1的位数）。

* `NextHop`（下一跳）：即指定的网关。

* 两个`Metric`（跃点）：大致表示这个路由的优先级，数字越小越优先。

* `PolicyStore`（存储策略）：表示这是临时路由（`ActiveStore`）还是永久路由（`PersistentStore`），其中临时路由会在重启后删除重设。

```plaintext
PS C:\Users\poker> Get-NetRoute

ifIndex DestinationPrefix                              NextHop                                  RouteMetric ifMetric PolicyStore
------- -----------------                              -------                                  ----------- -------- -----------
10      255.255.255.255/32                             0.0.0.0                                          256 65       ActiveStore
13      255.255.255.255/32                             0.0.0.0                                          256 25       ActiveStore
11      255.255.255.255/32                             0.0.0.0                                          256 25       ActiveStore
18      255.255.255.255/32                             0.0.0.0                                          256 25       ActiveStore
14      255.255.255.255/32                             0.0.0.0                                          256 50       ActiveStore
1       255.255.255.255/32                             0.0.0.0                                          256 75       ActiveStore
10      224.0.0.0/4                                    0.0.0.0                                          256 65       ActiveStore
13      224.0.0.0/4                                    0.0.0.0                                          256 25       ActiveStore
11      224.0.0.0/4                                    0.0.0.0                                          256 25       ActiveStore
18      224.0.0.0/4                                    0.0.0.0                                          256 25       ActiveStore
14      224.0.0.0/4                                    0.0.0.0                                          256 50       ActiveStore
1       224.0.0.0/4                                    0.0.0.0                                          256 75       ActiveStore
14      192.168.1.255/32                               0.0.0.0                                          256 50       ActiveStore
14      192.168.1.226/32                               0.0.0.0                                          256 50       ActiveStore
14      192.168.1.0/24                                 0.0.0.0                                          256 50       ActiveStore
18      172.19.73.255/32                               0.0.0.0                                          256 25       ActiveStore
18      172.19.73.29/32                                0.0.0.0                                          256 25       ActiveStore
18      172.19.73.0/24                                 0.0.0.0                                          256 25       ActiveStore
1       127.255.255.255/32                             0.0.0.0                                          256 75       ActiveStore
1       127.0.0.1/32                                   0.0.0.0                                          256 75       ActiveStore
1       127.0.0.0/8                                    0.0.0.0                                          256 75       ActiveStore
14      0.0.0.0/0                                      XXX.XXX.XXX.XXX                                    0 50       ActiveStore
18      0.0.0.0/0                                      XXX.XXX.XXX.XXX                                    0 25       ActiveStore
10      ff00::/8                                       ::                                               256 65       ActiveStore
13      ff00::/8                                       ::                                               256 25       ActiveStore
11      ff00::/8                                       ::                                               256 25       ActiveStore
18      ff00::/8                                       ::                                               256 25       ActiveStore
14      ff00::/8                                       ::                                               256 50       ActiveStore
1       ff00::/8                                       ::                                               256 75       ActiveStore
13      fe80::ddf5:310e:d09b:1326/128                  ::                                               256 25       ActiveStore
10      fe80::8b75:5968:ee8a:42d6/128                  ::                                               256 65       ActiveStore
18      fe80::5c8c:97bf:72c:71e9/128                   ::                                               256 25       ActiveStore
11      fe80::4fbb:4f7c:2d3c:426a/128                  ::                                               256 25       ActiveStore
14      fe80::3c65:d5a8:6d1:95cd/128                   ::                                               256 50       ActiveStore
10      fe80::/64                                      ::                                               256 65       ActiveStore
13      fe80::/64                                      ::                                               256 25       ActiveStore
11      fe80::/64                                      ::                                               256 25       ActiveStore
18      fe80::/64                                      ::                                               256 25       ActiveStore
14      fe80::/64                                      ::                                               256 50       ActiveStore
1       ::1/128                                        ::                                               256 75       ActiveStore
18      ::/0                                           XXXX::XXXX:XXXX:XXXX:XXXX                        256 25       ActiveStore
```

注意`NextHop`不为空的路由（一般`Metric`也最小），这就是有线和无线网默认的路由，我们新建路由时为避免冲突，要先删除这个（不用担心失误，重启后会恢复）

这些路由前面网段都是0.0.0.0/0（或::/0），表示全网段都可以使用这个路由。

从`Metric`可以发现，绝大多数电脑同时连有线和无线网时，都是有线网的`Metric`比较小，这也是为什么路由总是会优先选择有线网连接。Windows默认开启了`AutomaticMetric`，会按照带宽网速自动设定`Metric`[<sup>2<sup/>](#refer-anchor-2)，有需要可以去设置关闭

### 设备地址

输入指令`Get-CimInstance Win32_NetworkAdapterConfiguration | Select-Object Description, SettingID`，可以看到网卡以及对应的Guid

我们将来可以通过这个Guid，从注册表`HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Network\{4D36E972-E325-11CE-BFC1-08002BE10318}\{对应设备Guid}\Connection`的`PnPInstanceId`项判断是不是物理网卡（值以`PCI`开头是物理网卡，`BTH`开头是蓝牙网卡，其他是虚拟网卡）

```plaintext
PS C:\Users\poker> Get-CimInstance Win32_NetworkAdapterConfiguration | Select-Object Description, SettingID

Description                              SettingID
-----------                              ---------
Microsoft Kernel Debug Network Adapter   {2A714150-362D-497E-AC8B-A9F963B02478}
Realtek PCIe GbE Family Controller       {XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}
Intel(R) Wi-Fi 6 AX200 160MHz            {XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}
Microsoft Wi-Fi Direct Virtual Adapter   {33A4093B-99C7-478F-AF06-FD0A698B1FF5}
Microsoft Wi-Fi Direct Virtual Adapter   {F1F71D7B-D35B-4C65-8A91-DC94EE7C0A2E}
WAN Miniport (SSTP)                      {FA29F161-184C-4773-898D-A104510EE7F5}
WAN Miniport (IKEv2)                     {9859D6F0-2451-47BB-8748-7B1C5C542200}
WAN Miniport (L2TP)                      {EF4DCC46-BE1D-4FC7-8CFB-CF00F37AB9C8}
WAN Miniport (PPTP)                      {5E553B27-3FA5-445B-8A15-8249DF31AF3F}
WAN Miniport (PPPOE)                     {91899BE4-723E-43A6-8006-6BB2AFA4FC32}
WAN Miniport (IP)                        {CD5DD751-23AA-44F2-940F-4B565365892D}
WAN Miniport (IPv6)                      {DC0056A3-472D-4178-901C-131B8D8261E9}
WAN Miniport (Network Monitor)           {218400DD-182F-4BC4-A266-EBDB68EDD6DF}
Bluetooth Device (Personal Area Network) {2CA478BD-DADE-48B3-949B-66A882E18A72}
```

## 实现思路

接下来就是实现环节了，虽然指定网关听起来很容易。但如果切换网络之后，不仅网关可能会变，而且接口别名（InterfaceAlias）也会变，到时候再调整比较麻烦。

如果可以指定网卡，并指定网段就很方便了。实际上我们确实可以这样做，因为`Get-NetIPConfiguration`（或`Get-NetAdapter`）可以看出来：接口描述（`InterfaceDescription`）、接口别名（`InterfaceAlias`）和网关（`Gateway`）几乎是一一对应的关系，所以我们可以通过PowerShell（或C/C++）从接口描述查找网关，并设置路由，就可以达成目的。

至于网段分配，一般校园网都是连续的网段，比如说172.18.XXX.XXX都是校园网IP，那么就设置目标前缀（DestinationPrefix）为172.18.0.0/16，表示子网掩码是255.255.0.0，即前16位是固定的，后面可以变化。将这段路由优先级设最高，然后再设置剩下的路由（直接用0.0.0.0/0）全部走另一个网络（优先级第二高）。

另外还可以结合Proxifier等软件管理，如用Proxifier强大的代理筛选功能将校园网所有IP或程序都代理到某一台学校的服务器上，这样路由规则就可以只要指定一个IP了（如172.18.6.57/32）。

## 脚本代码

需要使用PowerShell7及以上运行。

在使用的时候，只需要按照需要修改`# Main`部分。

```powershell
# NetAdapterInfo
class NetAdapterInfo {
    [guid] $SettingID
    [string] $Description
    [string] $DefaultIPGateway

    NetAdapterInfo (
        [guid] $settingID,
        [string] $description,
        [string] $defaultIPGateway
    ) {
        $this.SettingID = $settingID
        $this.Description = $description
        $this.DefaultIPGateway = $defaultIPGateway
    }
}

# Functions
function Test-PhysicalNic {
    param (
        [Parameter(
            Mandatory,
            ValueFromPipeline
        )]
        [NetAdapterInfo]
        $Info
    )

    $str = Get-ItemProperty `
        -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Network\{4D36E972-E325-11CE-BFC1-08002BE10318}\{$($Info.SettingID)}\Connection" `
        -Name PnPInstanceId
    $str.PnPInstanceId.StartsWith("PCI")
}

function Get-PhysicalNics {
    Get-CimInstance `
        -Class Win32_NetworkAdapterConfiguration `
    | ForEach-Object {
        [NetAdapterInfo]::new(
            $_.SettingID,
            $_.Description,
            $_.DefaultIPGateway
        )
    } `
    | Where-Object { Test-PhysicalNic $_ }
}

function Remove-AdapterRoute {
    param (
        [string]
        $DestinationPrefix = "0.0.0.0/0"
    )
    Remove-NetRoute $DestinationPrefix
}

function Set-AdapterRoute {
    param (
        [NetAdapterInfo[]]
        $List,
        [string]
        $AdapterDescription,
        [string]
        $DestinationPrefix = "0.0.0.0/0",
        [UInt16]
        $RouteMetric = 0,
        [bool]
        $PersistentStore = $false
    )
    $Private:NextHop = ($List | Where-Object Description -EQ $AdapterDescription)[0].DefaultIPGateway
    New-NetRoute `
        $DestinationPrefix `
        -InterfaceAlias $AdapterDescription `
        -NextHop $Private:NextHop `
        -PolicyStore ($PersistentStore ? "PersistentStore" : "ActiveStore")
}

function Set-AdapterRoute {
    param (
        [NetAdapterInfo[]]
        $List,
        [string]
        $InterfaceDescription,
        [string]
        $DestinationPrefix = "0.0.0.0/0",
        [string]
        $IsIpv4 = $true,
        [UInt16]
        $RouteMetric = 0,
        [bool]
        $PersistentStore = $false
    )
    $InterfaceAlias = (Get-NetAdapter | Where-Object Name -EQ $InterfaceDescription)[0].Name
    $gateways = ($List | Where-Object Description -EQ $InterfaceAlias)[0].DefaultIPGateway
    if ($gateways -EQ "") {
        return
    }
    foreach ($gateway in $gateways.Split(' ')) {
        if (($IsIpv4 -and ([System.Net.IPAddress]::Parse($gateway).AddressFamily -EQ [System.Net.Sockets.AddressFamily]::InterNetwork)) -or `
            (!$IsIpv4 -and ([System.Net.IPAddress]::Parse($gateway).AddressFamily  -EQ [System.Net.Sockets.AddressFamily]::InterNetworkV6))) {
            New-NetRoute `
                $DestinationPrefix `
                -InterfaceAlias $InterfaceAlias `
                -NextHop $gateway `
                -PolicyStore ($PersistentStore ? "PersistentStore" : "ActiveStore") `
                -RouteMetric $RouteMetric
            return
        }
    }
}

# Main
$info = Get-PhysicalNics

Remove-AdapterRoute

Remove-AdapterRoute ::/0

Set-AdapterRoute $info "Realtek PCIe GbE Family Controller" 172.18.6.57/32

Set-AdapterRoute $info "Intel(R) Wi-Fi 6 AX200 160MHz" 0.0.0.0/0
```

## 代码仓库

包含完整PowerShell脚本和部分C++方法。

Github：<https://github.com/Poker-sang/RouteModifier>

## 参考资料

1. [NetTcpIp](https://learn.microsoft.com/powershell/module/nettcpip)

<div id="refer-anchor-2"/>
2. [Automatic Metric](https://learn.microsoft.com/troubleshoot/windows-server/networking/automatic-metric-for-ipv4-routes)
