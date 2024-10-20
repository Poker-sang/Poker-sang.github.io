---
title: 使用json代替resw文件
date: 2024-01-20
categories: WinUI
tags:
- C#
- .NET
---
## 前言

在写WinUI 3或UWP项目的时候，总觉得resw文件冗长可读性又差，希望要是能用json就好了。
我在测试MakePri.exe[^makepri]的时候意外发现了它支持一种叫resjson的文件，可以用以取代resw。

本文假定读者以有resw[^resw]的使用基础。

priconfig.xml部分内容：

```xml
<indexer-config type="resw" convertDotsToSlashes="true" initialPath=""/>
<indexer-config type="resjson" initialPath=""/>
```

## 对比

resjson虽然没有可视化编辑器，但它可读性十分高，可以直接用文本编辑器编辑。
相对而言resw文本可读性很低，几乎只能用可视化编辑器编辑。

resjson不支持注释，但其实注释除了可视化编辑器内其他地方都用不到，所以并没有什么用处。

另外用于`x:Uid`的属性写法，如`TextBox.Text`，在resjson中须将**点**换成**斜杠**，即`TextBox/Text`。
因为resjson默认没有设置`convertDotsToSlashes`。

## 语法

resjson的语法是标准json，但文件后缀名必须是resjson，而且内容只能包含简单的单个json对象，成员是字符串键和字符串值，如：

```json
{
    "String1": "字符串1内容",
    "TextBox2/Text": "字符串2",
    "TextBox2/AutomationProperties/Name": "字符串3"
}
```

也许大家注意到了第三句在resw里得写成：

```xml
TextBox2.[using:Windows.UI.Xaml.Automation]AutomationProperties.Name
```

然而方括号内的部分（附加属性）在resjson完全不需要写，并且效果是一样的，不理解为什么微软要求resw加上命名空间。

## 引用

引用方法和resw完全一致，放在指定位置并引用后，使用`x:Uid`或者`ResourceLoader`引用即可。

[^makepri]: [MakePri.exe](https://learn.microsoft.com/zh-cn/gaming/gdk/_content/gc/packaging/deployment/makepri)

[^resw]: [本地化字符串](https://learn.microsoft.com/zh-cn/windows/apps/windows-app-sdk/mrtcore/localize-strings)
