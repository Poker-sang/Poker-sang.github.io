---
title: 使用COM对AOT程序进行插件开发
date: 2025-01-14
categories: 进阶技巧
tags:
- C#
- .NET
- AOT
- COM
---
编写大型项目的时候，经常需要引入插件系统以便对功能进行扩展，同时降低功能间的耦合性。
但一般的插件系统大量运用反射技术，并且需要动态加载、卸载插件，听起来和AOT格格不入。
确实，在AOT运行环境下，没有.NET运行时，这限制我们只能加载同样是AOT（或直接由native语言）编译的库。

那么如何实现这种需求呢？好在现在我们有一个现成的成熟技术可以运用：COM（Component Object Model，组件对象模型）。它可以带着.NET运行时使用，也可以直接使用C++/IDL这种native语言编写，并且完全面向对象，简直就是为了AOT的插件系统而设计的技术（虽然它甚至比.NET/C#更老）。

## COM的优势与缺点

COM作为Windows底层的技术，系统对它有专门的优化，所以它运行速度非常快，和P/Invoke是同等水平的，比rpc这种要快许多。
而相对于引入函数的P/Invoke，COM又是面向对象的（或者说面向接口），所以更加灵活方便。
如果使用AOT、COM和.NET来实现插件系统的话，插件和原程序没有运行时的依赖关系，我们可以让主程序使用.NET 8，而插件使用.NET 9；甚至一方用C++，一方用Java AOT都是可以的，十分灵活方便。

COM的缺点也很明显，它只能在Windows和MacOS上使用，Linux系统不支持COM（也许可以安装相关环境）。此外既然是C++语言的接口，那它就只支持方法了，对于有各种奇技淫巧的C#接口来说略显原始。
此外使用AOT时，会像`[LibraryImport]`一样，对类型有各种限制，比如说需要指定`bool`类型封送方法、需要指定`string`的封送方法等。

## 基础概念

当COM通信的两方都是.NET程序时，将甲的对象封送到乙需要经过两步：

1. .NET对象转换为COM对象，变成CCW (COM Callable Wrapper)，以便COM主机进行操作，编程时看起来是个指针（`nint`）。
2. COM对象转换回.NET对象，变成RCW (Runtime Callable Wrapper)，以便乙进行调用，编程时看起来是个对象（`ComObject`或`IUnknown`等接口）。

大致示意图为：

{% mermaid %}
flowchart LR
    X--IDispatch---D
    A-->B--"IFoo"---C-->Y--"IFoo"---D-->E-->F--"IFoo"---G
    Z--IUnknown---D
    subgraph m1[托管代码乙]
        A[托管.NET应用程序]
        B((&ensp;))
        C["运行库可调用包装
        RCW"]
    end
    subgraph 非托管COM代码
        D[COM对象]
        X((&ensp;))
        Y((&ensp;))
        Z((&ensp;))
        E["COM可调用包装
        CCW"]
    end
    subgraph m2[托管代码甲]
        F((&ensp;))
        G[原托管对象]
    end
{% endmermaid %}

## 两种主要的AOT+COM插件方式

有多种加载COM插件的方式，一种称为OOP（Out Of Process，进程外），另一种称为InProc（In Process，进程内，又叫LocalServer方式），各有利弊。此外还有DCOM（Distributed COM，分布式COM）用于网络通信，但不常用。

OOP方式使用MsRpc框架，是跨进程通信，所以比较灵活，同时跨进程通信可能导致内存泄漏，效率也不是很高。[Dev Home](https://github.com/microsoft/devhome)就是使用这种方式实现的，感兴趣的可以看看它的源代码。

InProc方式就是本文着重介绍的方法，和普通的dll一样像一个库一样调用，处于同一个进程中，所以编写很方便，速度也比OOP方式快很多，比较适合不大不小的项目使用。

## ComWrappers源生成的写法

.NET现在主要有两套COM的写法。一种又叫内置COM，即`[ComImport]`相关的API，它从.NET Framework时期就有了，使用起来很方便，但不支持AOT。于是另一种`ComWrappers`的API就应运而生。

虽然`ComWrappers`从.NET 5起就有了，但`ComWrappers`源生成却是.NET 8才开始有的功能，之前需要手写大量的代码，十分麻烦还易错，所以我们现在不考虑.NET 8以下的环境（**以下所有代码均在.NET 8或以上的环境中编写**）。

我们只需要在指定的接口上写上`[GeneratedComInterface]`即可，且必须有`public`（或`internal`）和`partial`修饰符，这样才能让生成器工作：

```cs
[GeneratedComInterface]
[Guid("3FACA0D2-E7F1-4E9C-82A6-404FD6E0AAB8")]
public partial interface IFoo
{
    void Method(int i);
}
```

当实现接口时，我们只需要在类上加上`[GeneratedComClass]`即可，并且也需要`public`（或`internal`）和`partial`：

```cs
[GeneratedComClass]
public partial class Foo : IFoo
{
    public void Method(int i)
    {
        Console.WriteLine(i);
    }
}
```

当声明了`[GeneratedComInterface]`或`[GeneratedComClass]`后，这些类型和接口就在`StrategyBasedComWrappers`中完成了注册，我们可以直接使用这个`ComWrappers`来封送.NET对象：

```cs
StrategyBasedComWrappers wrappers1 = new();
Foo foo = new();
nint ccw = wrappers1.GetOrCreateComInterfaceForObject(foo, CreateComInterfaceFlags.None);
// ......
// 把ccw指针传递给本进程的其他地方后：
StrategyBasedComWrappers wrappers2 = new();
var iFoo = (IFoo)wrappers2.GetOrCreateObjectForComInstance(ccw, CreateObjectFlags.UniqueInstance);
_ = Marshal.Release(ccw); // ccw指针的对象不需要再使用，可以销毁
iFoo.Method(1);
```

这就是一个最简单的例子，代码中把一个.NET对象打包为易于传递的`nint`类型的指针；传递给别的地方后再由另一个`ComWrappers`组装为原来的接口对象，就可以调用它内部的方法了。

但要注意，转换回来的.NET对象并不能还原为原来的`Foo`类型对象：

```cs
// error
var foo = (Foo)wrappers2.GetOrCreateObjectForComInstance(ccw, CreateObjectFlags.UniqueInstance);
```

因为COM只将接口的成员转化为虚表（Virtual Table），并不知道原来的类型的内容。
这其实有利有弊，利就在于类型只要实现COM接口即可，剩下不论玩什么花活都可以，不像接口那样受到制约。

### ComInterface的约束

现在看起来和普通的C#接口写法也差不多，那为什么说接口受到很多约束呢？如果稍微有一些复杂的需求，就会发现接口会报错，其中有些我们可以解决，而有些只能另辟蹊径。

#### 接口成员只支持实例方法

.NET接口本身支持许多东西，如属性、事件、静态方法等，但这些在COM里通通不能用，所以我们只能使用最基础的实例方法。

#### string封送问题

作为最常用的类型，`string`的封送其实比较简单，只需要指定`string`字符编码即可。由于.NET和Windows底层都喜欢使用UTF16，所以我一般也使用UTF16进行封送：

```cs
[GeneratedComInterface(StringMarshalling = StringMarshalling.Utf16)]
[Guid(...)]
public partial interface IFoo
{
    void StringMethod(string s);
}
```

在`[GeneratedComInterface]`的参数指定`StringMarshalling`后，就不需要每次都在参数出现时指定了。但如果这也要求这条继承路径上的全部接口都使用系统的`StringMarshalling`值，即父接口、子接口都需要指定`StringMarshalling = StringMarshalling.Utf16`。

#### bool和数组封送问题

这两个封送和`[LibraryImport]`类似，其中`bool`比较简单，只需要写一个特性即可：

```cs
[GeneratedComInterface]
[Guid(...)]
public partial interface IFoo
{
    [return: MarshalAs(UnmanagedType.Bool)]
    bool BoolMethod([MarshalAs(UnmanagedType.Bool)] bool param);
}
```

而数组稍微麻烦一些，它需要指定长度。传入数组还比较方便，加一个长度参数即可：

```cs
[GeneratedComInterface]
[Guid(...)]
public partial interface IFoo
{
    void ArrayMethod(
        [MarshalUsing(CountElementName = nameof(count))] int[] array,
        int count);
}
```

而传出数组则比较麻烦，因为事先不知道它的长度，那么一般有两个思路：

1. 类似于迭代器，一个一个获取：

    ```cs
    [GeneratedComInterface]
    [Guid(...)]
    public partial interface IFoo
    {
        [return: MarshalAs(UnmanagedType.Bool)]
        bool NextArrayItem(out int next);
    }
    ```

   其中返回值表示还有没有更多元素，若有，则`next`中值有效。

2. 另一种方法也是我比较喜欢使用的方法，即调用两次，第一次获取长度，第二次传入长度获取数组：

    ```cs
    [GeneratedComInterface]
    [Guid(...)]
    public partial interface IFoo
    {
        int GetArrayCount();

        [return: MarshalUsing(CountElementName = nameof(count))]
        int[] GetArray(int count);
    }
    ```

#### 其他支持参数类型

ComInterface基础支持的类型和`[LibraryImport]`类似，只要上面提到的那些类型，和`int`等数字的基本类型。
但还有一点是`[LibraryImport]`方式难以企及的方便：它支持使用已经声明过`[GeneratedComInterface]`的接口。这极大简化了对象的传递流程：

```cs
[GeneratedComInterface]
[Guid(...)]
public partial interface IFoo1 { ... }


[GeneratedComInterface]
[Guid(...)]
public partial interface IFoo2
{ 
    IFoo1 Method(IFoo2 iFoo2);
}
```

这说明我们设计插件框架时，只需要拿到第一个COM传递的.NET对象后，就可以拿到剩余所有的其他对象了。

## AOT+COM插件系统设计技巧

### 加载和卸载插件

在AOT环境下，不能使用`Assembly.Load`这种方式加载程序集，那我们只能使用最基础的`LoadLibrary`函数：

```cs
try
{
    var hModule = LoadLibrary("path/to/your/aot/dll");
    // use hModule ...
}
finally
{
    _ = FreeLibrary(hModule);
}

// 建议使用Microsoft.Windows.CsWin32自动生成此函数引用，此处这样写为了方便演示
public static partial class Win32NativeMethods
{
    [LibraryImport("kernel32.dll", EntryPoint = "LoadLibraryW", SetLastError = true, StringMarshalling = StringMarshalling.Utf16)]
    public static partial nint LoadLibrary(string libFilename);

    [LibraryImport("kernel32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static partial bool FreeLibrary(nint hModule);
}
```

加载程序集后，我们需要调用其中的指定函数，才能进行通信。
得到这个指定的函数后，可以让它把自己的对象封装为指针`ccw`并返回，这样我们用COM通信就得到了第一个.NET对象：

```cs
try
{
    var hModule = LoadLibrary("path/to/your/aot/dll");
    var funcPtr = GetProcAddress(hModule, nameof(DllGetObject));
    var func = Marshal.GetDelegateForFunctionPointer<DllGetObject>(funcPtr);
    if (func(out nint ccw) is not 0)
        return;
    // 拿到ccw后，以下代码和之前一样
    StrategyBasedComWrappers wrappers = new();
    var foo = (IFoo)wrappers.GetOrCreateObjectForComInstance(ccw, CreateObjectFlags.UniqueInstance);
    _ = Marshal.Release(ccw);
    // 可以从foo的方法里拿到其他所有.NET对象 ...
}
finally
{
    _ = FreeLibrary(hModule);
}

// 建议使用Microsoft.Windows.CsWin32自动生成此函数引用，此处这样写为了方便演示
public static partial class Win32NativeMethods
{
    // ...
    
    [LibraryImport("kernel32.dll", SetLastError = true)]
    public static partial nint GetProcAddress(nint hModule, [MarshalAs(UnmanagedType.LPStr)] string lpProcName);
}

public delegate int DllGetObject(out nint ppv);
```

```cs
// AOT dll内部代码
public static class Program
{
    internal static StrategyBasedComWrappers ComWrappers { get; } = new();

    private static IFoo _foo { get; } = new Foo();

    [UnmanagedCallersOnly(EntryPoint = nameof(DllGetObject))]
    private static unsafe int DllGetObject(void** ppv)
    {
        var comWrappers = new StrategyBasedComWrappers();
        *ppv = (void*)comWrappers.GetOrCreateComInterfaceForObject(_foo, CreateComInterfaceFlags.None);
        return 0;
    }
}
```

注意定义`IFoo`的类库可以被AOT dll和程序本体同时引用，这样我们可以更好地保持dll和程序本体的扩展接口的一致性。

### 更方便地进行扩展

而由于COM对象转回.NET对象只能使用接口，而与原类型无关。所以类型可以不暴露给主程序。一个简单的依赖图如下：

{% mermaid %}
flowchart LR
    main[主程序（AOT）] ---> common
    dll[扩展dll（AOT）] --> sdk --传递引用--> common
    subgraph NuGet包
        common[/"Extensions.Common
    接口 IFoo"/]
        sdk[/"Extensions.SDK
    类型 Foo"/]
    end
{% endmermaid %}

#### 属性

既然类型不会影响COM封送，我们就可以用继承简化扩展的继承操作：

```cs
// Extensions.Common
[GeneratedComInterface]
[Guid(...)]
public partial interface IFoo
{ 
    int GetProperty1();
}

// Extensions.SDK
[GeneratedComClass]
public abstract partial class Foo : IFoo
{
    public abstract int Property1 { get; }

    int IFoo.GetProperty1() => Property1;
}
```

这样可以让继承类型的人写起来更加方便，符合C#规范。

由于调用方（主程序）无法使用这个类型，所以暂时无法简化，但等.NET 10的extension出来后，就可以使用扩展属性的方式实现了。不过还有其他的可以简化：

#### 数组

对于主程序，用`FooHelper`简化；对于插件，仍然使用继承抽象类方式简化（但要确保多次访问`Array`属性得到的是同一个对象）：

```cs
// Extensions.Common
[GeneratedComInterface]
[Guid(...)]
public partial interface IFoo
{ 
    int GetArrayCount();

    [return: MarshalUsing(CountElementName = nameof(count))]
    int[] GetArray(int count);
}

public static class FooHelper
{
    public static int[] GetArray(this IFoo foo)
    {
        var count = foo.GetArrayCount();
        return foo.GetExtensions(count);
    }
}

// Extensions.SDK
[GeneratedComClass]
public abstract partial class FooBase : IFoo
{
    public abstract int[] Array { get; }

    int IFoo.GetArray(int count) => Array;

    int IFoo.GetArrayCount() => Array.Length;
}
```

#### 复杂现有类型封送

对于复杂的现有类型（如`Stream`），我们都是在上面搭一层兼容层来使用的（把原对象作为一个字段放入适配器对象）：

```cs
[GeneratedComInterface]
[Guid(...)]
public partial interface IStream { ... }

public static class StreamHelper
{
    public IStream ToIStream(this Stream stream) => new NetToComStream(stream);

    public Stream ToStream(this IStream iStream) => new ComToNetStream(iStream);
}

// 也可以将以下两个类合二为一
[GeneratedComClass]
internal partial class NetToComStream : IStream { ... }

internal class ComToNetStream : Stream { ... }
```

#### 支持异步方法

由于COM接口方法返回值不能直接使用`Task`，我们要实现异步就要复杂一些。其中一个思路是，包裹`TaskCompleteSource`实现异步状态的监听。
以下是一个简单的示例：

```cs
[GeneratedComInterface(StringMarshalling = StringMarshalling.Utf16)]
[Guid("CAB05B3A-321C-43DE-8A21-B2819999E97F")]
public partial interface ITaskCompletionSource
{
    void SetCompleted();

    void SetException(string message);
}

[GeneratedComClass]
internal partial class TaskCompletionSourceWrapper(TaskCompletionSource source) : ITaskCompletionSource
{
    public TaskCompletionSource Source { get; } = source;

    public Task Task => Source.Task;

    public void SetCompleted() => Source.SetResult();

    public void SetException(string message) => Source.SetException(new Exception(message));
}
```

当我们需要声明异步方法时，可以：

```cs
// Extensions.Common
[GeneratedComInterface(StringMarshalling = StringMarshalling.Utf16)]
[Guid("3C330C19-8DC1-4180-B309-D446139D387D")]
public partial interface IFoo
{
     void DoThings(ITaskCompletionSource task, IStream originalStream);

     IStream? GetDoThingsResult();
}

public static class FooHelper
{
    public static async Task<IStream?> DoThingsAsync(this IFoo foo, IStream originalStream)
    {
        var wrapper = new TaskCompletionSourceWrapper(new());
        foo.DoThings(wrapper, originalStream);
        await wrapper.Task;
        return foo.GetDoThingsResult();
    }
}

// Extensions.SDK
[GeneratedComClass]
public abstract partial class FooBase : IFoo
{
    public abstract Task<IStream?> DoThingsAsync(IStream originalStream);

    private IStream? _doThingsResult;

    async void IFoo.DoThings(ITaskCompletionSource task, IStream originalStream)
    {
        var completed = false;
        var exceptionString = "";
        try
        {
            if (await DoThingsAsync(originalStream) is { } result)
            {
                _doThingsResult = result;
                task.SetCompleted();
                completed = true;
            }
            else
                exceptionString = "result is null";
        }
        catch (Exception e)
        {
            exceptionString = e.Message;
        }
        finally
        {
            if (!completed)
                task.SetException(exceptionString);
        }
    }

    IStream? IFoo.GetDoThingsResult() => _doThingsResult;
}
```

这样不论从主程序还是插件dll看来，都是一个封装完好的异步方法。

## 参考文献

1. [cnbluefire](https://github.com/cnbluefire)大佬的手把手教导
2. [ComWrappers 源生成](https://learn.microsoft.com/dotnet/standard/native-interop/comwrappers-source-generation/)
