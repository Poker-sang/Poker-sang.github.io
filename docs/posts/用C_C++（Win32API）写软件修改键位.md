---
title: 用C/C++（Win32API）写软件修改键位
date: 2021-06-25
category:
  - 编程
tag:
  - 键盘
  - C/C++
  - Windows
---

## 前言

紧接上篇[《Windows用注册表修改键盘映射（扫描码）》](../Windows用注册表修改键盘映射（扫描码）)，
用起来会发现处处不协调，除了需要熟悉新键位以外，最重要的是原本的**快捷键**也被拆散了，如原本都在左下角的**Ctrl+Z/X/C/V**。
所以我们应该在保证快捷键相对位置不变的情况下，修改其他字母的位置，在本专栏中使用**键盘钩子**（**Keyboard Hook**）。

注：

- 由于软件很小而且要不安全操作，所以选择C/C++来写，并且暂时不显示窗口页面。

- 每段代码会分别展示C/C++的写法，C在前、C++在后，两者相同时只会标注为C代码。一般来说C的代码C++也可以用，但写C++时建议用C++的标准。

- **使用本方法改键位可能会被某些游戏判为作弊！**但上篇专栏修改注册表的方法不会。

## 引入

本次我们以**德沃夏克键盘**（**Dvorak Keyboard**）为例，把Qwerty键盘修改为德沃夏克键盘。

Qwerty键盘（Qwerty Keyboard）

|     |     |     |     |     |     |     |      |     |     |      |     |
| --- | --- | --- | --- | --- | --- | --- | ---- | --- | --- | ---- | --- |
| 1 ! | 2 @ | 3 # | 4 $ | 5 % | 6 ^ | 7 & | 8 \* | 9 ( | 0 ) | - \_ | + = |
| Q   | W   | E   | R   | T   | Y   | U   | I    | O   | P   | [ {  | ] } |
| A   | S   | D   | F   | G   | H   | J   | K    | L   | ; : | ' "  |     |
|     | Z   | X   | C   | V   | B   | N   | M    | , < | . > | / ?  |     |

德沃夏克键盘（Dvorak Keyboard）

|     |     |     |     |     |     |     |      |     |     |      |     |
| --- | --- | --- | --- | --- | --- | --- | ---- | --- | --- | ---- | --- |
| 1 ! | 2 @ | 3 # | 4 $ | 5 % | 6 ^ | 7 & | 8 \* | 9 ( | 0 ) | [ {  | ] } |
| ' " | , < | . > | P   | Y   | F   | G   | C    | R   | L   | / ?  | + = |
| A   | O   | E   | U   | I   | D   | H   | T    | N   | S   | - \_ |     |
|     | ; : | Q   | J   | K   | X   | B   | M    | W   | V   | Z    |     |

此外，根据维基百科[^wiki]：

> 钩子编程（Hooking），也称作“挂钩”，是计算机程序设计术语，指通过拦截软件模块间的函数调用、消息传递、事件传递来修改或扩展操作系统、应用程序或其他软件组件的行为的各种技术。处理被拦截的函数调用、事件、消息的代码，被称为钩子（Hook）。

简单来说就是拦截你输入的信息，处理过后再给电脑。

## 编写方法

以下默认引用头文件

```c
#include<Windows.h>
```

首先是`WinMain()`函数，这里只有两件事要做：安装键盘钩子和进行事件循环。

注：因为`keyboardHook`在其他函数里也会用到，所以是全局变量。

```c
// 键盘钩子
static HHOOK keyboardHook = NULL;
// 可编辑的键总数
#define KeysCount 47
```

```c++
static HHOOK KeyboardHook = nullptr;
constexpr auto KeysCount = 47;
```

```c
// 主程序
int WINAPI WinMain(_In_ HINSTANCE hInstance, _In_opt_ HINSTANCE hPreINstance, _In_ LPSTR lpCmdLine, _In_ int nCmdShow)
{
    // 安装键盘钩子
    keyboardHook = SetWindowsHookExW(WH_KEYBOARD_LL, &KeyboardProc, hInstance, NULL);
    if (keyboardHook == NULL) // nullptr in C++
        return 1;
    // 进行事件循环
    MSG msg;
    while (GetMessageA(&msg, NULL, 0, 0)) // nullptr in C++
    {
        TranslateMessage(&msg);
        DispatchMessageA(&msg);
    }
    return msg.wParam;
}
```

事件循环并不重要，所以可以直接抄网上的代码，安装钩子主体是创建一个新对象，这部分需要重点解释。

## 修改键位

`KeyboardLayoutList`数列规定了各种键盘的布局，其中第一个键盘是Qwerty键盘，第二个以德沃夏克键盘为例（如S对应O，D对应E）。

注：由于后面一个函数`keybd_event()`需要BYTE类型的字符，所以我们用BYTE类型定义。

```c
// 某些键盘上符号的虚拟键代码
#define _11 VK_OEM_3
#define _12 VK_OEM_MINUS
#define _13 VK_OEM_PLUS
#define _21 VK_OEM_4
#define _22 VK_OEM_6
#define _23 VK_OEM_5
#define _31 VK_OEM_1
#define _32 VK_OEM_7
#define _41 VK_OEM_COMMA
#define _42 VK_OEM_PERIOD
#define _43 VK_OEM_2
```

```c++
#pragma region 某些键盘上符号的虚拟键代码
constexpr auto _11 = VK_OEM_3;
constexpr auto _12 = VK_OEM_MINUS;
constexpr auto _13 = VK_OEM_PLUS;
constexpr auto _21 = VK_OEM_4;
constexpr auto _22 = VK_OEM_6;
constexpr auto _23 = VK_OEM_5;
constexpr auto _31 = VK_OEM_1;
constexpr auto _32 = VK_OEM_7;
constexpr auto _41 = VK_OEM_COMMA;
constexpr auto _42 = VK_OEM_PERIOD;
constexpr auto _43 = VK_OEM_2;
#pragma endregion
```

```C
// Qwerty键盘（序号0）
BYTE QwertyKb[KeysCount] = {
    _11, '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', _12, _13,
    'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', _21, _22, _23,
    'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', _31, _32,
    'Z', 'X', 'C', 'V', 'B', 'N', 'M', _41, _42, _43 };

// 德沃夏克键盘（序号1）
BYTE DvorakKb[KeysCount] = {
    _11, '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', _21, _22,
    _32, _41, _42, 'P', 'Y', 'F', 'G', 'C', 'R', 'L', _43, _13, _23,
    'A', 'O', 'E', 'U', 'I', 'D', 'H', 'T', 'N', 'S', _22,
    _21, 'Q', 'J', 'K', 'X', 'B', 'M', 'W', 'V', 'Z' };
```

```C
// 键盘列表
BYTE* KeyboardLayoutList[2] = { QwertyKb, DvorakKb };
```

```C++
#include<vector>
std::vector<BYTE*> KeyboardLayoutList{ QwertyKb, DvorakKb };
```

首先记录原键盘的键位，代码中一行代表现实中的一行（其实不记录也没关系，但如果以后要搞自定义键盘功能时，就一定要先留一个默认布局）

其中这些宏或常量表达式是为了提高可读性，对应了键盘上的标点符号，可以见`WinUser.h`的文件里定义：

```c
// WinUser.h
#define VK_OEM_1          0xBA   // ';:' for US
#define VK_OEM_PLUS       0xBB   // '+' any country
#define VK_OEM_COMMA      0xBC   // ',' any country
#define VK_OEM_MINUS      0xBD   // '-' any country
#define VK_OEM_PERIOD     0xBE   // '.' any country
#define VK_OEM_2          0xBF   // '/?' for US
#define VK_OEM_3          0xC0   // '`~' for US
```

当需要用某种布局时，只要改变选择的序号就可以了：

```c
// 目前选择的键盘序号
int KeyboardLayoutIndex = 1;
```

## 安装钩子

这段是本项目的核心区：

```c
// 某键是否被按下
// nVirtualKey: int 需判断的键
// return: bool 发送的键对应在数组里的序号
#define IsKeyPressed(nVirtualKey) ((GetKeyState(nVirtualKey) & (1 << (sizeof(SHORT) * 8 - 1))) != 0)

// 发送键盘事件
// index: int
#define Kbe(index) keybd_event(KeyboardLayoutList[KeyboardLayoutIndex][index], 0, 0x0000, 1 << 24)
```

```C++
inline auto IsKeyPressed(const int nVirtualKey) { return (GetKeyState(nVirtualKey) & (1 << (sizeof(SHORT) * 8 - 1))) != 0; }

inline auto Kbe(const int index) { keybd_event(KeyboardLayoutList[KeyboardLayoutIndex][index], 0, 0x0000, 1 << 24); }
```

```C
// 键盘钩子处理程序
LRESULT CALLBACK KeyboardProc(int nCode, WPARAM wParam, LPARAM lParam)
{
    const PKBDLLHOOKSTRUCT p = (PKBDLLHOOKSTRUCT)lParam;
    bool handled = false;
    if (wParam == WM_KEYDOWN)
        if (p->dwExtraInfo != 1 << 24 &&
            !IsKeyPressed(VK_CONTROL) &&
            !IsKeyPressed(VK_LWIN) &&
            !IsKeyPressed(VK_RWIN) &&
            !IsKeyPressed(VK_MENU) &&
            !IsKeyPressed(VK_TAB))
            for (int i = 0; i < KeysCount; ++i)
                if (p->vkCode == QwertyKb[i])
                {
                    handled = true;
                    Kbe(i);
                }
    if (handled)
        return 1;
    return CallNextHookEx(keyboardHook, nCode, wParam, lParam);
}
```

```C++
inline LRESULT CALLBACK KeyboardProc(int nCode, WPARAM wParam, LPARAM lParam)
{
    const auto p = reinterpret_cast<PKBDLLHOOKSTRUCT>(lParam);
    auto handled = false;
    if (wParam == WM_KEYDOWN)
        if (p->dwExtraInfo != 1 << 24 &&
            !IsKeyPressed(VK_CONTROL) &&
            !IsKeyPressed(VK_LWIN) &&
            !IsKeyPressed(VK_RWIN) &&
            !IsKeyPressed(VK_MENU) &&
            !IsKeyPressed(VK_TAB))
            for (auto i = 0; i < KeysCount; ++i)
                if (p->vkCode == QwertyKb[i])
                {
                    handled = true;
                    Kbe(i);
                }
    if (handled)
        return 1;
    return CallNextHookEx(KeyboardHook, nCode, wParam, lParam);
}
```

从`KeyboardProc()`开始看，首先`p`储存了**键盘事件**，即当前按下或抬起了什么键。`handled`是一个**临时标志**，表示有没有对键盘事件进行处理，表示是否对键盘事件进行处理，处理了为`true`。

下面就要写除了快捷键以外的键位修改了，一般来说快捷键开头都是**Ctrl**、**Win**、**Alt**、**Tab**以及它们的组合（Shift一般不会出现在第一个，因为Shift按下会转换符号或者转换大小写），所以当以上四个键（左右Win键算同一个）按下时就不处理，其他才会处理，当确定要处理时，令`handled`变为`true`。

`IsKeyPressed()`：当按键按下时，`GetKeyState()`返回值（SHORT类型）的最高位为`1`，否则为`0`，所以与图中`1<<(sizeof(SHORT)*8-1)`按位与结果不为`0`就是按下，为`0`就是没按下。

下面是一个`for`循环，找到原键位的键后映射到新的键，用`Kbe()`（`keybd_event()`）进行处理。有四个参数，第一个填虚拟键值，之前已经定义好；第二个填扫描码（可见上个专栏），但可以不填；第三填选项标志，键抬起时为`KEYEVENTF_KEYUP`，落下时为`0`，此处填`0`；最后一个是附加信息，要填`1<<24`因为根据MSDN[^msdn]，最后一个`ULONG_PTR`类型参数对应了`p`中的`dwExtraInfo`，可以传递额外的信息，而`dwExtraInfo`只有25-28位是保留的，其他都会被其他的信息占据，所以填`1<<24`（刚好到25位）。如果不是我们目标的键，进入`default`，也不处理。

最后，如果处理了数据就返回`1`，表示屏蔽原来的事件并发送已编辑的新事件，第二次再被抓获时会因为`dwExtraInfo`的标志而直接不处理跳过；如果不处理数据则直接放行事件，并让下一个钩子再处理。

综上，一个KeyboardCorrector项目就写完了，可以完成预设的任务，并有自定义键位的改进空间。

注：关闭软件时可以用任务管理器，也可以在程序里设置快捷键关闭。

## 完整代码（Github）

C：<https://github.com/Poker-sang/KeyboardCorrector/blob/main/KeyboardCorrector.c>

C++（C++/CLI）：<https://github.com/Poker-sang/KeyboardCorrector/blob/main/KeyboardCorrector/KeyboardCorrector.h>

[^wiki]: [Wikipedia](https://zh.wikipedia.org/zh-hans/钩子编程)

[^msdn]: [微软文档](https://docs.microsoft.com/en-us/windows/win32/api/winuser)
