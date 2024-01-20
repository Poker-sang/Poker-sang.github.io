---
title: 利用PowerShell修改网络配置
date: 2022-03-30
categories: 编程
tags:
- PowerShell
- 网络
- Windows
---
## 前言

修改IP、网关、子网掩码、DNS等配置时需要打开网络配置器配置，有些麻烦。尤其是经常需要重复性操作时（例如去学校图书馆蹭网）。用PowerShell脚本自动修改，方便简单而且十分轻量，程序只需占用1KB空间。

## 新的修改方法：Common Information Model (CIM)

参考[^GetCimInstance]

```PowerShell
param([int] $inputNum)

$cim = Get-CimInstance Win32_NetworkAdapterConfiguration -Filter "IPEnabled = True"

function CheckReturn {
    param ($obj)
    if ($obj.ReturnValue -eq 0) {
        "Successed"
    }
    else {
        "Failed"
    }
}

if ($inputNum -eq 0) {
    CheckReturn(Invoke-CimMethod $cim -MethodName EnableDHCP)
    CheckReturn(Invoke-CimMethod $cim -MethodName SetDNSServerSearchOrder)
}
elseif (($inputNum -gt 0) -and ($inputNum -lt 254)) {
    CheckReturn(Invoke-CimMethod $cim -MethodName EnableStatic -Arguments @{
            IPAddress  = @("10.200.200." + $inputNum.ToString());
            SubnetMask = @("255.255.255.0")
        })
    CheckReturn(Invoke-CimMethod $cim -MethodName SetGateways -Arguments @{
            DefaultIPGateway = @("10.200.200.254")
        })
    CheckReturn(Invoke-CimMethod $cim -MethodName SetDNSServerSearchOrder -Arguments @{
            DNSServerSearchOrder = @("114.114.114.114")
        })
}
else {
    "Input number between 1 to 253 to set network adapter, or 0 to disable network adapter"
}
```

## 旧的修改方法：Windows Management Instrumentation (WMI)

参考[^GetWmiObject]

```PowerShell
param([int] $inputNum)

$wmi = Get-WmiObject Win32_NetworkAdapterConfiguration -Filter "IPEnabled = True"

function CheckReturn {
    param ($obj)
    if ($obj.ReturnValue -eq 0) {
        "Successed"
    }
    else {
        "Failed"
    }
}

if ($inputNum -eq 0)
{
    CheckReturn($wmi.EnableDHCP())
    CheckReturn($wmi.SetDNSServerSearchOrder())
}
elseif (($inputNum -gt 0) -and ($inputNum -lt 254))
{
    CheckReturn($wmi.EnableStatic("10.200.200." + $inputNum.ToString(), "255.255.255.0"))
    CheckReturn($wmi.SetGateways("10.200.200.254"))
    CheckReturn($wmi.SetDNSServerSearchOrder("114.114.114.114"))
}
else
{
    "Input number between 1 to 253 to set network adapter, or 0 to disable network adapter"
}
```

## 附：C#代码

```C#
#nullable enable
using System.Management;
using System.Runtime.InteropServices;
using System.Runtime.Versioning;

namespace NetworkAdapter;

[SupportedOSPlatform(nameof(OSPlatform.Windows))]
public static class NetworkAdapter
{
    public static void Main()
    {
        while (true)
        {
            if (!int.TryParse(Console.ReadLine(), out var temp))
                continue;
            switch (temp)
            {
                case 0:
                    DisableNetworkAdapter();
                    return;
                case > 0 and < 254:
                    SetNetworkAdapter("10.200.200." + temp, "255.255.255.0", "10.200.200.254", "114.114.114.114");
                    return;
                default:
                    Console.WriteLine("输入错误：请输入机房电脑序号（1-253），输入0恢复默认网络设置");
                    break;
            }
        }
    }
    private static void SetNetworkAdapter(string ipAddress, string subnetMask, string gateway, string dns)
    {
        if (GetManagementObject() is { } mo)
        {
            var inPar = mo.GetMethodParameters("EnableStatic");
            //设置ip地址和子网掩码
            inPar["IPAddress"] = new[] { ipAddress };
            inPar["SubnetMask"] = new[] { subnetMask };
            _ = mo.InvokeMethod("EnableStatic", inPar, null!);

            //设置网关地址
            inPar = mo.GetMethodParameters("SetGateways");
            inPar["DefaultIPGateway"] = new[] { gateway };
            _ = mo.InvokeMethod("SetGateways", inPar, null!);

            //设置DNS
            inPar = mo.GetMethodParameters("SetDNSServerSearchOrder");
            inPar["DNSServerSearchOrder"] = new[] { dns };
            _ = mo.InvokeMethod("SetDNSServerSearchOrder", inPar, null!);
        }
    }

    private static void DisableNetworkAdapter()
    {
        if (GetManagementObject() is { } mo)
        {
            _ = mo.InvokeMethod("SetDNSServerSearchOrder", Array.Empty<object>());
            _ = mo.InvokeMethod("EnableDHCP", Array.Empty<object>());
        }
    }

    private static ManagementObject? GetManagementObject()
    {
        var mc = new ManagementClass("Win32_NetworkAdapterConfiguration");
        var moc = mc.GetInstances();
        foreach (var o in moc)
            if ((bool)o["IPEnabled"])
                return (ManagementObject)o;

        return null;
    }
}
```

## 完整代码（Github）

<https://github.com/Poker-sang/NetworkAdapter>

[^GetCimInstance]: [Get-CimInstance](https://learn.microsoft.com/powershell/scripting/samples/getting-wmi-objects--get-ciminstance-)

[^GetWmiObject]: [Get-WmiObject](https://learn.microsoft.com/powershell/module/microsoft.powershell.management/get-wmiobject)
