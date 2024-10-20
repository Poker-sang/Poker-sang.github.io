---
title: STA模型、同步上下文和多线程、异步调度
date: 2024-10-20
categories: WinUI
tags:
- C#
- .NET
---
写过任何桌面应用，尤其是WinForm的朋友们应该见过，`Main`函数上放置了一个`[STAThread]`的Attribute。
而且几乎所有的桌面应用框架，都是由同一个UI线程来执行渲染操作的，这表现为从其他线程修改控件的值就会抛异常：

```cs
await Task.Run(() => control.Content = ""); // throws exception
```

大家一定都能猜出STA和UI线程一定有千丝万缕的联系，事实也的确如此（WinUI 3也是一个STA的框架）。

## 如何在其他线程修改UI

不论在什么框架中，只要使用了异步，就一定会有这种需求，因为异步获取到的数据就是为了显示的。

WPF中，若要从别的线程修改控件的属性，你需要使用`Dispatcher`（`DispatcherPriority`是可选参数）：

```cs
control.Dispatcher.Invoke(DispatcherPriority.Normal, () => control.Content = "");
```

而WinUI 3中也有类似的操作，只是API名称有些变化（注意应使用`DispatcherQueue`而不是`Dispatcher`，`DispatcherQueuePriority`也是可选参数）：

```cs
control.DispatcherQueue.TryEnqueue(DispatcherQueuePriority.Normal, () => control.Content = "");
```

可为什么我们无法获取插入委托的完成时间或返回值呢？
也许你的这个念头一闪而过，但还好我们用`Dispatcher`多是用来更新UI，所以完成时间和返回值都不是很重要，
不过之后我们还是可以得到这个问题的答案。

## STA模型下异步线程调度的区别

```cs
async void ButtonClicked(object sender, RoutedEventArgs e)
{
    var data = await FetchDataAsync();
    ((Button)sender).Content = data;
}
```

如果是只在控制台项目很熟悉异步的人，应该就会担心上面这段代码，如果不进行任何处理的话，
给`Content`赋值这个操作会在执行异步的那个线程继续执行。
然而如果运行这段代码会发现并没有出现问题，这是因为执行完异步后它会回到原来的线程（即UI线程），这就涉及到线程调度的区别了。

```cs
Debug.WriteLine(Environment.CurrentManagedThreadId);
await Task.Run(() => Debug.WriteLine(Environment.CurrentManagedThreadId));
Debug.WriteLine(Environment.CurrentManagedThreadId);
```

以上这段代码，在控制台项目和窗口项目（WPF、WinUI 3等）会有完全不同的两个结果：

- 控制台项目中，输出结果形如`1 2 2`
- 窗口项目中，输出结果形如`1 2 1`

可以得出结论，正是因为会回到原来的线程，所以在WinUI 3等框架中我们可以放心大胆地使用大量异步，而不用担心需要频繁调用`DispatcherQueue`导致代码变丑。

可它为什么可以回到原线程，而控制台项目不行？
尝试在控制台项目`Main`函数上添加`[STAThread]`，还是没有效果，说明`[STAThread]`不是决定性因素。

## 同步上下文

这就涉及到另外一个概念，同步上下文（Synchronization Context）。
分别在两个项目中查看`SynchronizationContext.Current`可以发现，
控制台项目的`SynchronizationContext.Current`是`null`，而窗口项目则不是`null`。

是的，同步上下文才是让运行完回到主线程的真正原因。

大致流程为：

1. 程序开始运行，遇到了异步语句。
2. `Task`首先捕获原来线程的调度器（`TaskScheduler`），如果没捕获到就用默认调度器。
3. `Task`首先捕获原来线程的同步上下文。
4. 将异步任务交给了某一线程执行。
5. 异步任务执行完毕后，异步之后的语句会变成一个回调用于传递。
6. 使用调度器执行回调。
7. 默认调度器的行为：看捕获的同步上下文是否为空，若不为空就使用它运行该回调，为空则在线程池（`ThreadPool`）里运行回调。

我第一次了解以上的原理时，我想：也许可以实现一个自己的同步上下文？于是尝试使用以下的代码运行。

```cs
SynchronizationContext.SetSynchronizationContext(new SynchronizationContext());
Debug.WriteLine(Environment.CurrentManagedThreadId);
await Task.Run(() => Debug.WriteLine(Environment.CurrentManagedThreadId));
Debug.WriteLine(Environment.CurrentManagedThreadId);
```

可结果却还是失败了。我百思不得其解，于是查看[WPF源码](https://github.com/dotnet/wpf/blob/main/src/Microsoft.DotNet.Wpf/src/WindowsBase/System/Windows/Threading/DispatcherSynchronizationContext.cs)，
终于得到了解答。
WPF的同步上下文重写了默认的基类`DispatcherSynchronizationContext`，其中最重要的是它重写了`Post`方法，

- 原来的`SynchronizationContext`中，`Post`方法使用`ThreadPool`来执行传入的回调。
- 而WPF的重写中，用`_dispatcher.BeginInvoke`执行了传递进来的委托。
这`Dispatcher`正是我们用来在别的线程修改UI时用的方法，这下逻辑终于闭环了。

`async/await`语法使得异步后的语句，虽然看起来是同步的，但实际上还是异步的回调（`ContinueWith`）。
由默认调度器的逻辑，把回调语句交给了同步上下文来执行，而同步上下文又调用`Dispatcher`，回调最终回到了主线程执行。

而`Dispatcher`就是一个事件循环，同步（顺序）地不断执行着外部传入的事件，所以根本不知道传入的任务什么时候才会执行。
这也是为什么无法在[之前](#如何在其他线程修改ui)提到的`DispatcherQueue.TryEnqueue`中获知完成时间或获取返回值。

## ConfigureAwait(bool)的作用

听到将回调送回主线程执行时，也许有人会想到这个方法，听起来作用差不多：

```cs
Task.ConfigureAwait(bool continueOnCapturedContext)
```

没错，这个方法就是为了抑制调用同步上下文的行为的。既然是抑制调用同步上下文，那么如果没有同步上下文（`SynchronizationContext.Current`为`null`），`ConfigureAwait`自然不起作用。

而当在有同步上下文的窗口项目中，`.ConfigureAwait(false)`就发挥它的作用了：

```cs
Debug.WriteLine(Environment.CurrentManagedThreadId);
await Task.Run(() => Debug.WriteLine(Environment.CurrentManagedThreadId)).ConfigureAwait(false);
Debug.WriteLine(Environment.CurrentManagedThreadId);
```

结果居然出现了形如`1 2 2`的，在控制台项目才会出现的结果，这正是`ConfigureAwait`的作用：
抑制调用`SynchronizationContext`，回调会继续在原来异步的线程上执行。

既然回到主线程就可以直接操作UI了，这么好用为什么要抑制呢？

## 自动回到主线程的缺点

### 性能降低

有一定基础的程序员都知道，进程切换开销太大，所以出现了线程；
线程切换开销也是很大，于是又出现了协程（异步）。所以我们要避免频繁切换线程。

自动回到主线程的模型中，切换时会将线程相关的上下文送到另一个线程以供执行，执行结束后又将结果的上下文送回原线程，这些操作耗费了大量开销。
但仔细想想，第二步送回的操作有时是完全没有必要的，例如如果异步后不需要更新UI，就不需要回到主线程。

这样，我们得到了一个优化的思路：对无需修改UI的分支使用`.ConfigureAwait(false)`。

### 线程死锁

大家在作为新手自己探索桌面应用的时期，一定或多或少遇到过异步转同步的需求。
但自己按照网上的说法调用`.GetAwaiter().GetResult()`或`.Wait()`或`.Result`后，居然把UI卡死了。
这正是同步上下文导致的。

以下代码可以在WinUI 3中复刻卡死UI：

```cs
Task.Run(() => Thread.Sleep(100))
    .ContinueWith(_ => { }, TaskScheduler.FromCurrentSynchronizationContext())
    .GetAwaiter().GetResult();
```

而在控制台项目中，我们先设置一个不会回到主线程的同步上下文（不然`TaskScheduler.FromCurrentSynchronizationContext()`方法会找不到同步上下文而抛异常），然后再执行相同的代码：

```cs
SynchronizationContext.SetSynchronizationContext(new SynchronizationContext());
Task.Run(() => Thread.Sleep(100))
    .ContinueWith(_ => { }, TaskScheduler.FromCurrentSynchronizationContext())
    .GetAwaiter().GetResult();
```

结果并没有卡死。这是为什么呢？

其实有了之前的知识，我们很容易推出结论：

1. 主线程遇到异步转同步的耗时操作后，会挂起等待操作完成。
2. 操作已经完成，开始执行回调，但主线程仍然在等待该语句完成。
3. 回调的`TaskScheduler`要求调用同步上下文（即主线程）来运行回调任务，而此时主线程还在等待该操作执行完毕返回。

综上，两个线程互相等待的死锁形成了。
但是这个缺点，并不是让我们不要使用自动回到主线程的同步上下文，
而是遇到这种同步上下文时，异步转同步的操作一定要谨慎操作。

## 当STA遇到同步上下文

刚才的文章，仿佛是在说STA和同步上下文是两个不相关的东西，只是单线程渲染UI的需求让它们捆绑起来出现。
那如果这两者遇到了会发生什么呢？

我们先来看STA的定义：

> STA（Single Thread Apartment，单线程套间）是一种线程模型，
> 用在程序的入口方法上，来指定当前线程的ApartmentState是STA，用在其他方法上不产生影响。
> 这个属性只在COM（Component Object Model，组件对象模型）Interop有用，如果全部是托管代码则无用。
> 其它的还有MTA（Multi Thread Apartment，多线程套间）、NTA（Neutral Threaded Apartment，中立线程套间）。

虽然有点摸不着头脑，但原来`[STAThread]`是为了COM交互服务的。WinUI 3作为一个源码是WinRT（COM）实现的框架，UI部分自然要大量和COM交互，自然UI线程和STA线程是同一个线程。

那么一个问题出现了，假如我在异步转同步的方法体内执行COM交互，是不是也会导致死锁？

答案是肯定的，但并不是所有的COM交互都会导致死锁：

在COM中，除了线程有三种套间类型，COM对象也有五种套间模型，并在注册表里面可以通过ThreadingModel属性指定对象所期望的套间类型，它们的对应关系分别是：

- Main（默认）：主STA（第一个创建的STA）
- Apartment：STA
- Both：STA或MTA
- Free：MTA
- Neutural：NTA

只有只接受STA的对象才会要求回到主线程进行交互，也就是因类型（对象）而异。
由于COM资料少难度大，我也不是很清楚相关知识，只好建议大家不要在异步转同步操作中使用COM相关API。

## 参考文献

1. [ConfigureAwait FAQ](https://devblogs.microsoft.com/dotnet/configureawait-faq/)
2. [COM和套间(Apartments) 1 - 基本知识](https://blog.csdn.net/ATField/article/details/1824640)
