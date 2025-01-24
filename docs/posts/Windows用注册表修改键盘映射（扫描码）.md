---
title: Windows用注册表修改键盘映射（扫描码）
date: 2020-10-18
category:
  - 编程
tag:
  - 键盘
  - 注册表
  - Windows
---

## 前言

使用C/C++代码方式修改可见下篇[《用C/C++（Win32API）写软件修改键位》](../用C_C++（Win32API）写软件修改键位)

据说Qwerty键盘是为了降低打字员打字速度，防止打字机卡机所作出的妥协。那么现在的键盘是否降低了咱敲代码的速度？试试看换成其他的键盘布局吧。

注：注册表修改映射的方法比较麻烦，但适用性还挺高，不需要依靠其他软件，所以不会被软件或游戏认定为作弊。

注：常用快捷键Ctrl+Z、Ctrl+C等可能会变的不方便。

## 确定目标

首先明确要将键盘修改成什么样子，我以网上[^kb]找到的一种键盘布局为例。

|     |     |     |     |     |     |     |     |     |     |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| X   | B   | O   | T   | H   | W   | U   | Y   | G   | M   |
| R   | L   | C   | I   | A   | E   | N   | Z   | J   |     |
|     | K   | V   | Q   | D   | F   | S   | P   |     |     |

注：这里的修改仅限于主键盘区26个字母（其实只修改了25个x）。

## 修改方法

首先打开注册表（**Win+R**输入**regedit**并运行），并且进入目录：

```url
HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Keyboard Layout
```

在该目录下右键点击**新建二进制值**，名称为**Scancode Map**，并打开。

接下来按照如下格式[^win10kb]输入自己需要更改的键位：

```Binary
00 00 00 00 00 00 00 00（固定格式）
XX 00 00 00（XX为修改的总键数+1的16进制数）
XX XX XX XX（修改后的按键扫描码（在前）+原按键的扫描码（在后））
XX XX XX XX（另一个要替换的按键，同上）
......
00 00 00 00（固定格式）
```

以上就是修改键位的格式，理论上可以修改254个键（包含键盘所有键有余）。

其中提到的**扫描码**是一个16进制数字，每个代表一个键，扫描码表如下（左列为高位、右列为低位）：

注：如果要禁用一个键，将这个键映射为00 00即可。

|               |       |     |              |       |     |          |       |     |                 |       |     |                 |       |
| ------------- | ----- | --- | ------------ | ----- | --- | -------- | ----- | --- | --------------- | ----- | --- | --------------- | ----- |
| Backspace     | 0E 00 |     | 9            | 49 00 |     | / ?      | 35 00 |     | S               | 1F 00 |     | DBE_SBCSCHAR    | 77 E0 |
| Caps Lock     | 3A 00 |     | -            | 4A 00 |     | ; :      | 27 00 |     | T               | 14 00 |     | CONVERT         | 79 E0 |
| Delete        | 53 E0 |     | /\*          | 37 00 |     | [ {      | 1A 00 |     | U               | 16 00 |     | NONCONVERT      | 7B E0 |
| End           | 4F E0 |     | .            | 53 00 |     | \ &#124; | 2B 00 |     | V               | 2F 00 |     | Internet        | 01 E0 |
| Enter         | 1C 00 |     | /            | 35 00 |     | ] }      | 1B 00 |     | W               | 11 00 |     | iTouch          | 13 E0 |
| Escape        | 01 00 |     | /+           | 4E 00 |     | ` ~      | 29 00 |     | X               | 2D 00 |     | Shopping        | 04 E0 |
| HOME          | 47 E0 |     | Enter        | 1C E0 |     | = +      | 0D 00 |     | Y               | 15 00 |     | Webcam          | 12 E0 |
| Insert        | 52 E0 |     | F1           | 3B 00 |     | 0 )      | 0B 00 |     | Z               | 2C 00 |     | Back            | 6A E0 |
| Left Alt      | 38 00 |     | F2           | 3C 00 |     | 1 !      | 02 00 |     | Close           | 40 E0 |     | Favorites       | 66 E0 |
| Left Ctrl     | 1D 00 |     | F3           | 3D 00 |     | 2 @      | 03 00 |     | Fwd             | 42 E0 |     | Forward         | 69 E0 |
| LeSh ftift    | 2A 00 |     | F4           | 3E 00 |     | 3 #      | 04 00 |     | Help            | 3B E0 |     | HOME            | 32 E0 |
| Left Windows  | 5B E0 |     | F5           | 3F 00 |     | 4 $      | 05 00 |     | New             | 3E E0 |     | Refresh         | 67 E0 |
| Num Lock      | 45 00 |     | F6           | 40 00 |     | 0.05     | 06 00 |     | Office Home     | 3C E0 |     | Search          | 65 E0 |
| Page Down     | 51 E0 |     | F7           | 41 00 |     | 6 ^      | 07 00 |     | Open            | 3F E0 |     | Stop            | 68 E0 |
| Page Up       | 49 E0 |     | F8           | 42 00 |     | 7 &      | 08 00 |     | Print           | 58 E0 |     | My Pictures     | 64 E0 |
| Power         | 5E E0 |     | F9           | 43 00 |     | 8 \*     | 09 00 |     | Redo            | 07 E0 |     | My Music        | 3C E0 |
| PrtSc         | 37 E0 |     | F10          | 44 00 |     | 9 (      | 0A 00 |     | Reply           | 41 E0 |     | Mute            | 20 E0 |
| Right Alt     | 38 E0 |     | F11          | 57 00 |     | A        | 1E 00 |     | Save            | 57 E0 |     | Play/Pause      | 22 E0 |
| Right Ctrl    | 1D E0 |     | F12          | 58 00 |     | B        | 30 00 |     | Send            | 43 E0 |     | Stop            | 24 E0 |
| Right Shift   | 36 00 |     | F13          | 64 00 |     | C        | 2E 00 |     | Spell           | 23 E0 |     | +(Volume up)    | 30 E0 |
| Right Windows | 5C E0 |     | F14          | 65 00 |     | D        | 20 00 |     | Task Pane       | 3D E0 |     | - (Volume down) | 2E E0 |
| Scroll Lock   | 46 00 |     | F15          | 66 00 |     | E        | 12 00 |     | Undo            | 08 E0 |     | Media           | 6D E0 |
| Sleep         | 5F E0 |     | Down         | 50 E0 |     | F        | 21 00 |     | Mute            | 20 E0 |     | Mail            | 6C E0 |
| Space         | 39 00 |     | Left         | 4B E0 |     | G        | 22 00 |     | Next Track      | 19 E0 |     | Web/Home        | 32 E0 |
| Tab           | 0F 00 |     | Right        | 4D E0 |     | H        | 23 00 |     | Play/Pause      | 22 E0 |     | Messenger       | 05 E0 |
| Wake          | 63 E0 |     | Up           | 48 E0 |     | I        | 17 00 |     | Prev Track      | 10 E0 |     | Calculator      | 21 E0 |
| 0             | 52 00 |     | Calculator   | 21 E0 |     | J        | 24 00 |     | Stop            | 24 E0 |     | Log Off         | 16 E0 |
| 1             | 4F 00 |     | E-Mail       | 6C E0 |     | K        | 25 00 |     | Volume Down     | 2E E0 |     | Sleep           | 5F E0 |
| 2             | 50 00 |     | Media Select | 6D E0 |     | L        | 26 00 |     | Volume Up       | 30 E0 |     | Help(on ke F1y) | 3B E0 |
| 3             | 51 00 |     | Messenger    | 11 E0 |     | M        | 32 00 |     | ? -             | 7D 00 |     | Undo(on ke F2y) | 08 E0 |
| 4             | 4B 00 |     | My Computer  | 6B E0 |     | N        | 31 00 |     |                 | 45 E0 |     | Redo(on ke F3y) | 07 E0 |
| 5             | 4C 00 |     | ’ ”          | 28 00 |     | O        | 18 00 |     | Next to Enter   | 2B E0 |     | Fwd (on ke F8y) | 42 E0 |
| 6             | 4D 00 |     | - \_         | 0C 00 |     | P        | 19 00 |     | Next to L-Shift | 56 E0 |     | Send(on ke F9y) | 43 E0 |
| 7             | 47 00 |     | , <          | 33 00 |     | Q        | 10 00 |     | Next to R-Shift | 73 E0 |     |                 |       |
| 8             | 48 00 |     | . >          | 34 00 |     | R        | 13 00 |     | DBE_KATAKANA    | 70 E0 |     |                 |       |

例如`1D 00 5B E0`代表了用左Ctrl键（`1D 00`）替换左Win键（`5B E0`）

我替换26字母则需要打如下的码（此处U映射不变，所以共替换25个，25+1的16进制数为1A）：

```Binary
00 00 00 00 00 00 00 00
1A 00 00 00 2D 00 10 00
30 00 11 00 18 00 12 00
14 00 13 00 23 00 14 00
11 00 15 00 15 00 17 00
22 00 18 00 32 00 19 00
13 00 1E 00 26 00 1F 00
2E 00 20 00 17 00 21 00
1E 00 22 00 12 00 23 00
31 00 24 00 2C 00 25 00
24 00 26 00 25 00 2C 00
2F 00 2D 00 10 00 2E 00
20 00 2F 00 21 00 30 00
1F 00 31 00 19 00 32 00
00 00 00 00
```

一切准备妥当后，确定并关闭。

最后**重启**（或注销并重新登录）电脑就可以使用新的键盘映射啦。

注：若要回到默认映射，在注册表中删除本**Scancode Map**文件即可。

[^kb]: [给中国人的键盘 —适合中英文双输入的键盘布局](http://www.docin.com/p-23672137.html)

[^win10kb]: [Windows10 修改键位映射](https://blog.csdn.net/lhdalhd1996/article/details/90741092)
