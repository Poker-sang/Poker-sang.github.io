---
title: 基于Proxifier和V2Ray的嵌套代理方案
date: 2024-02-29
categories: 编程
tags:
- 网络
- 代理
- Windows
---
## 前言

最近遇到了一个比较奇怪的需求：我的电脑只能访问到局域网内的服务器A，而服务器A可以访问到服务器B国内网络，
服务器B可以访问到国外网络。

当电脑简单地使用服务器A进行代理的时候，就可以变成正常的家庭网络了（只能访问国内网络）；
但我此时需要使用服务器B进行代理以访问github的时候，发现系统代理已经被设置了。
这时我想起用Proxifier解决这个问题。

## 工具介绍

### Proxifier

Proxifier通过对R0层劫持过滤驱动实现对所有软件都几乎透明的代理。

使用这个软件的原因除了可以更方便地处理路由之外，还是为了让不走系统代理的应用也可以走代理。
此外，实现嵌套代理也离不开它。

### V2Ray (Core)

V2Ray是当前主流的代理软件之一，功能很强大、灵活。

但缺点是现在常见的V2Ray可视化客户端（如V2RayN）都无法实现V2Ray的全部功能，
为了更好地指定路由，我使用V2Ray Core（以下简称V2Ray）来实现需要的功能。

## 梳理流程

1. 当访问国内网络时，我们只需要像普通代理一样使用服务器A：

    主机 --> 服务器A --> 国内网站

2. 当访问国外网络时，我们需要经过A、B两个服务器：

    主机 --> 服务器A --> 服务器B --> 国外网站

为了写成Proxifier需要的格式，我们需要进一步简化，将其简化为“原本目标；转发目标”：

1. 当发送请求给国内网站时，转发给服务器A的本地代理

2. 当发送请求给国外网站时，转发给服务器B的本地代理

3. 当请求发送给服务器A时，直接发送（不转发）

4. 当发送请求给服务器B时，转发给服务器A的本地代理

由于服务器A、B是被包含在国内（外）网站里的，所以我们要提升它们优先级，即按34、12的顺序排序。
这些规则应该写在Proxifier的Proxification Rules页面里。

## 分辨国内外网站

谈论理论觉得很容易，但真正上手写的时候会发现有不少问题，如：如何分辨国内外的网站？

V2Ray软件自带geoip、geosite文件，包含的网站已经足够日常使用了，但我没找到方法让Proxifier读取这个文件。
所以我用V2Ray的路由功能。

打开服务器B本地代理的配置文件（config.json），此处以绕过大陆的配置为例，节选`outbounds`和`routing`部分：

```json
"outbounds": [
    {
        "tag": "proxy",
        // ...
    },
    {
        "tag": "direct",
        "protocol": "freedom",
        "settings": {}
    },
    {
        "tag": "block",
        "protocol": "blackhole",
        "settings": {
            "response": {
                "type": "http"
            }
        }
    }
]
"routing": {
    "domainStrategy": "AsIs",
    "rules": [
        {
            "type": "field",
            "inboundTag": [
                "api"
            ],
            "outboundTag": "api"
        },
        {
            "type": "field",
            "outboundTag": "block",
            "domain": [
                "geosite:category-ads-all"
            ]
        },
        {
            "type": "field",
            "outboundTag": "direct",
            "domain": [
                "geosite:cn"
            ]
        },
        {
            "type": "field",
            "outboundTag": "direct",
            "ip": [
                "geoip:private",
                "geoip:cn"
            ]
        },
        {
            "type": "field",
            "port": "0-65535",
            "outboundTag": "proxy"
        }
    ]
}
```

关于V2Ray的配置可以参考这两个文档[^doc][^doc2]。

`outbounds`应该包含了三个最基础的配置，分别是代理、直连、拦截。
然后`routing`的规则将国内流量引到直连，其他的流量默认走代理。

所以我的思路是修改直连的逻辑，替换为服务器A的`outbounds`中的`proxy`项，但它的`tag`字段仍为`direct`不要修改。
如果仍有真正`direct`需求，可以再加一个`actualdirect`项。

此时Proxifier的路由规则也简化为了：

1. 当请求发送给服务器A时，直接发送（不转发）

2. 当发送请求给服务器B时，转发给服务器A的本地代理

3. 当发送请求给国内外网站时，转发给服务器B的本地代理

## 简化掉服务器A的本地代理

看完上一段后，大家肯定会觉得，为什么还需要保留服务器A的本地代理，直接让服务器B的本地代理的路由处理了不就好了？

我也是这么认为的，但在实践的过程中遇到了问题：

* Proxifier自动域名解析

    查看Proxifier的日志时，可以发现接受到的对服务器B的请求还是域名的形式，而在服务器A的本地代理日志中就变成了IP形式。
    就算关闭了Proxifier的名字解析器（Name Resolution）还是如此。

* 通过V2Ray端口筛选路由

    我尝试通过端口筛选出对服务器B访问流量，虽然已经在日志中看到了对应条目，但还是连不上。

最终我选择了保留服务器A的本地代理，如果有大佬知道解决方案请告诉我x。

[^doc]: [V2Ray官方文档](https://www.v2fly.org/)

[^doc2]: [V2Ray白话文教程](https://selierlin.github.io/v2ray/)
