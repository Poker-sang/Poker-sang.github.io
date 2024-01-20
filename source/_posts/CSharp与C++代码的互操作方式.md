---
title: C#与C++代码的互操作方式
date: 2024-01-10
categories: 编程
tags:
- C#
- .NET
- C/C++
- COM
- 平台调用
---
## 大致介绍

在写C#程序时经常有与本地代码（C/C++）代码交互的需求。微软提供了许多种方式供我们选择，
最常用的有以下三种（A->B指A可以引用B）：

{% mermaid %}
flowchart LR
    A--P/Invoke-->B
    A<--C++ Interop-->C
    A<--COM Interop-->D
    D<-->C-->B
    subgraph 托管环境
        A[.NET应用程序]
    end
    subgraph 非托管环境
        B[C 库函数]
        C[C++ 类库]
        D[COM组件]
    end
{% endmermaid %}

* P/Invoke (Platform Invoke)：平台调用，是一种用于和非托管函数进行交互的技术，
在调用Windows API的时候有大量的运用。特点是无需编写兼容层代码即可使用。
* C++ Interop：托管C++，使用C++/CLI (Common Language Infrastructure)语言，
特点是可以将托管代码和非托管代码写在一个文件/程序集里，从而使得它十分灵活，它本质上还是平台调用。
* COM (Component Object Model)：组件对象模型，是微软早在.NET出现之前就提出的一种Windows开发技术，
现在Windows中到处都有它参与。虽然它是很老的技术，但在最新的技术中也可以看到它的身影（如WinUI3）。
需不需要写兼容层代码取决于原来的代码有没有使用COM，如Win32就没有使用，而WinRT使用了。

那么如何从这之中选择呢？以下列出了三种方式的大致区别：

|            | P/Invoke   | C++ Interop | COM Interop  |
| ---------- | ---------- | ----------- | ------------ |
| 支持平台   | 全平台     | 仅Windows   | 理论上全平台 |
| 语言       | 标准C/C++  | C++/CLI     | IDL          |
| 导出对象   | 函数       | 类          | 类           |
| 引用方式   | DllImport  | 直接引用    | ComImport    |
| 上手难度   | 几乎无难度 | 简单        | 复杂         |
| 兼容层代码 | 不需要     | 需要        | 可能需要     |

## 性能测试

选择一种技术最重要的指标就是效率了，我测试了三种技术分别在大量调用、大量执行次数情况下的表现情况。
调用次数是由托管代码实现的（即调用`Test`的次数），执行次数是由本地代码实现的（即传入的参数`executions`）。
我选择了`IsWindows10OrGreater`函数进行调用测试：

```c++
HRESULT Test(int executions)
{
    for (int i = 0; i < executions; ++i)
    {
        IsWindows10OrGreater();
    }
    return S_OK;
}
```

源代码可以参见仓库[^InteropPerformanceTest]，
我在Windows11 64位系统下运行，使用.NET 8运行时，以下是测试结果：

| 调用/执行次数 | P/Invoke | C++ Interop | COM Interop |
| ------------- | -------- | ----------- | ----------- |
| 1000000/1     | 01.162s  | 01.327s     | 32.504s     |
| 1/1000000     | 01.054s  | 01.294s     | 01.063s     |

可见除了大量调用COM，其他的方法效率都差不多。这是因为每次调用COM都会产生一个COM对象，
从而导致速度很慢。三种方法都有类型封送（Marshal）操作，这也是最花时间部分，所以使用时间都差不多。
可以从下面流程图了解大致流程：

P/Invoke流程图

{% mermaid %}
flowchart LR
    B-->C-->F--平台调用<br/>封送处理-->G
    D~~~E
    subgraph 非托管
        subgraph G[DLL]
            A[非托管函数]
        end
    end
    subgraph 托管
        B[托管源代码]
        C[编译器]
        subgraph CLR
            subgraph F[程序集]
                direction TB
                D[元数据]
                E[IL代码]
            end
        end
    end
{% endmermaid %}

COM流程图

{% mermaid %}
flowchart LR
    X--IDispatch---F
    Y--ISimpleCOMCalculator---F
    Z--IUnknown---F
    A-->B
    C-->D-->B-->E-->Y
    subgraph 托管代码
        A[托管应用程序]
        B[元数据代理]
        C[COM组件类型库]
        D([类型库导入程序<br/>TlbImp.exe])
    end
    E[运行库课调用包装<br/>RCW]
    subgraph 非托管COM代码
        F[COM对象]
        X((&ensp;))
        Y((&ensp;))
        Z((&ensp;))
    end
{% endmermaid %}

## 个人看法

P/Invoke的两端是标准的C/C++和标准的C#（.NET）代码，是保持可移植性、可读性的不二之选。
平台调用流程相对简单，过程更加透明，在绝大多数情况下都应该选择它。
但它的缺点是无法导出类，如果大型项目有面对对象的需求（类似于DirectX）则不是最优选择。

C++ Interop灵活性非常高，可以准确控制封送过程，所以性能理论上也更好。
但是缺点[^cppcli]也更严重，它只能面向Windows平台，
很多情况下这个缺点是不能接受的。如果目标项目是只面向Windows平台（如WinForm，WPF等），
且要调用大量本地API，而且对性能要求较苛刻的情况下，可以考虑使用。

COM有着很复杂的内部结构，学习成本较高。如果写小型项目，即使有面向对象的需求也不需要使用它。
但如果接触Windows平台编程，几乎绕不开调用COM，所以也要对调用COM代码有一定程度的了解。
同时也要避免创建大量COM对象，这可能导致性能低下。

可以参考《精通.NET互操作 P/Invoke，C++Interop和COM Interop》[^book]这本书来学习。

[^InteropPerformanceTest]: [InteropPerformanceTest](https://github.com/Poker-sang/InteropPerformanceTest)

[^cppcli]: [C++/CLI .NET Core 限制](https://learn.microsoft.com/dotnet/core/porting/cpp-cli#ccli-net-core-limitations)

[^book]: 《精通.NET互操作 P/Invoke，C++Interop和COM Interop》 黄际洲 崔晓源 著
