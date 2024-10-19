---
title: XAML中DataTemplate变量隐藏的解决方法
date: 2023-11-13
categories: 编程
tags:
- C#
- .NET
- XAML
---
## 前言

微软的许多XAML框架，如WPF、UWP、WinUI3等，在`DataTemplate`下都会遇到变量隐藏（Variable shadowing）的问题。为了访问外部实例成员，经常需要写很多曲折的代码，但也没有办法。本文也无法解决这个问题，但记录了我知道的方法，以便在各种情况使用，争取将可读性的影响降到最低。

## 问题再现

按照需求创建了一个`Page`：

```c#
public sealed partial class SamplePage : Page
{
    public string OuterMember { get; set; } = "OuterMember";

    public SamplePage()
    {
        ViewModels = new ViewModel[] { new("a"), new("b"), new("c"), };
        InitializeComponent();
    }

    public ViewModel[] ViewModels { get; }
}

public class ViewModel(string text)
{
    public string Text { get; set; } = text;
}
```

```xml
<Page
    x:Class="SampleApp.SamplePage"
    ...>
    <ItemsRepeater ItemsSource="{x:Bind ViewModels}">
        <ItemsRepeater.ItemTemplate>
            <DataTemplate x:DataType="local:ViewModel">
                <TextBlock Text="{x:Bind Text}" />
            </DataTemplate>
        </ItemsRepeater.ItemTemplate>
    </ItemsRepeater>
</Page>
```

大部分情况下，写到这种程度就能完成任务了。但有时候需要把外部的成员（如`OuterMember`）传给`DataTemplate`内的控件（如此处的`TextBlock`），那么如何实现呢？

首先可以发现，在DataTemplate内并非只能使用ViewModel类的成员，而还能访问以下这些东西：

* static成员

* StaticResource

* 事件处理方法

据此我们就可以利用这些来实现跨域（scope）访问类实例成员。一共有三种思路：

## 解决方案

### Static转实例

这是很常用的方法，就连官方库都可以看到这样的实现，例如`Application.Current`。

那我们可以仿照这样写：

```c#
public sealed partial class SamplePage : Page
{
    public static SamplePage Current { get; private set; }

    public SamplePage()
    {
        Current = this;
        ...
    }
    ...
}
```

此时在XAML中就可以：

```xml
...
<DataTemplate x:DataType="local:ViewModel">
    <TextBlock Text="{x:Bind local:SamplePage.Current.OuterMember}" />
</DataTemplate>
...
```

这样写的优点是简洁明了，缺点是只能单例使用

### StaticResource

这种方法也有人使用：

```c#
public class Box
{
    public object Content { get; set; }
}

public sealed partial class SamplePage : Page
{
    public SamplePage()
    {
        ...
        InitializeComponent();
        ((Box)Resources["Box"]).Content = OuterMember;
    }
    ...
}
```

```xml
...
<Page.Resources>
    <local:Box x:Key="Box" />
    <local:UnboxConverter x:Key="UnboxConverter" />
</Page.Resources>
<ItemsRepeater ItemsSource="{x:Bind ViewModels}">
    <ItemsRepeater.ItemTemplate>
        <DataTemplate x:DataType="local:ViewModel">
            <TextBlock Text="{x:Bind Converter={StaticResource UnboxConverter}, ConverterParameter={StaticResource Box}}" />
        </DataTemplate>
    </ItemsRepeater.ItemTemplate>
</ItemsRepeater>
...
```

`Box`是用来装箱的，防止使用值类型时复制赋值导致前后不是同一个对象。

这种方法优点是十分灵活，处理方法写在`Converter`里，传递参数写在`Box`里，可以随意扩展，几乎没有限制。

缺点也很明显，写了许多不明所以的代码，逻辑曲折难懂，而且外部`OuterMember`变化后难以通知到内部。

### 事件处理

这种方法可以很方便地获取需要的参数，但可能需要多写一个子控件：

```c#
public sealed partial class SampleControl : UserControl
{
    public event Func<SamplePage>? ThisRequested;

    public string? GetOuterMember => ThisRequested?.Invoke().OuterMember;

    public SampleControl()
    {
        InitializeComponent();
    }
}
```

```xml
<UserControl
    x:Class="SampleApp.SampleControl"
    ...>
    <TextBlock Text="{x:Bind GetOuterMember}" />
</UserControl>
```

原页面只需：

```c#
public sealed partial class SamplePage : Page
{
    private SamplePage MyControlOnThisRequested() => this;
    ...
}
```

```xml
...
<DataTemplate x:DataType="local:ViewModel">
    <local:SampleControl ThisRequested="MyControlOnThisRequested"/>
</DataTemplate>
...
```

这种方法十分优雅，也很灵活，缺点是要单独写一个子控件。但如果由于`DataTemplate`内容太长，本来就打算分开写控件，那这个缺点就不存在了。

总之三个方法各有利弊，大家可以根据需要选择最合适的。
