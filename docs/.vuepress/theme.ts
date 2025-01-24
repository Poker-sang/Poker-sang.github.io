import { hopeTheme } from 'vuepress-theme-hope'
import navbar from './navbar'
import sidebar from './sidebar'

export default hopeTheme({
  hostname: 'https://poker-sang.github.io/',

  author: {
    name: '扑克',
    url: 'https://github.com/Poker-sang/',
  },

  logo: '/avatar.png',
  favicon: '/avatar.png',

  repo: 'Poker-sang/poker-sang.github.io',

  docsDir: 'docs',

  docsBranch: 'master',

  pageInfo: [
    'Author',
    'Date',
    'Original',
    'Category',
    'Tag',
    'ReadingTime',
    'Word',
  ],

  // 导航栏
  navbar,

  // 侧边栏
  sidebar,

  // 页脚
  footer:
    '<a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/"><img alt="知识共享许可协议" style="border-width:0" src="https://licensebuttons.net/l/by-nc-sa/4.0/88x31.png" /></a><br />本作品采用<a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/">知识共享署名-非商业性使用-相同方式共享 4.0 国际许可协议</a>进行许可。',
  displayFooter: true,

  // 此处开启了很多功能用于演示，你应仅保留用到的功能。
  markdown: {
    align: true,
    attrs: true,
    codeTabs: true,
    component: true,
    demo: true,
    figure: true,
    gfm: true,
    linkify: false,
    imgLazyload: true,
    imgSize: true,
    include: true,
    mark: true,
    plantuml: true,
    spoiler: true,
    stylize: [
      {
        matcher: 'Recommended',
        replacer: ({ tag }) => {
          if (tag === 'em')
            return {
              tag: 'Badge',
              attrs: { type: 'tip' },
              content: 'Recommended',
            }
        },
      },
    ],
    sub: true,
    sup: true,
    tabs: true,
    tasklist: true,
    vPre: true,

    // 取消注释它们如果你需要 TeX 支持
    math: {
      type: 'mathjax',
    },

    // 如果你需要幻灯片，安装 @vuepress/plugin-revealjs 并取消下方注释
    // revealjs: {
    //   plugins: ["highlight", "math", "search", "notes", "zoom"],
    // },

    // 在启用之前安装 vuepress.chart
    // chartjs: true,

    // insert component easily

    // 在启用之前安装 echarts
    // echarts: true,

    // 在启用之前安装 flowchart.ts
    // flowchart: true,

    // 在启用之前安装 mermaid
    mermaid: true,

    // playground: {
    //   presets: ["ts", "vue"],
    // },

    // 在启用之前安装 @vue/repl
    // vuePlayground: true,

    // 在启用之前安装 sandpack-vue3
    // sandpack: true,
  },

  // 多语言配置
  metaLocales: {
    editLink: '在 GitHub 上编辑此页',
  },

  // 如果想要实时查看任何改变，启用它。注: 这对更新性能有很大负面影响
  hotReload: true,

  blog: {
    description: '好累好累好累好累好累',

    intro: 'https://github.com/Poker-sang',

    medias: {
      GitHub: 'https://github.com/Poker-sang',
      BiliBili: 'https://space.bilibili.com/8528315',
      Rss: '/rss.xml',
    },
  },

  // 在这里配置主题提供的插件
  plugins: {
    blog: true,

    icon: {
      assets: 'iconify',
      prefix: 'fa6-solid:',
    },

    // 暂时没有 所以不启用
    //   docsearch: {
    //     appId: '',
    //     apiKey: '',
    //     indexName: '',
    //   },

    git: {
      createdTime: true,
      updatedTime: true,
      contributors: true,
      transformContributors: contributors =>
        Object.values(
          contributors.reduce(
            (a, b) => {
              a[b.email] = b
              return a
            },
            {} as Record<string, (typeof contributors)[0]>,
          ),
        ),
    },

    copyCode: {},

    copyright: {
      global: true,
      license: 'CC-BY-NC-SA 4.0',
    },

    comment: {
      provider: 'Giscus',
      repo: 'Poker-sang/Poker-sang.github.io',
      repoId: 'R_kgDOK4DTFw',
      category: 'Announcements',
      categoryId: 'DIC_kwDOK4DTF84CmRUk',
      mapping: 'title',
    },

    feed: {
      atom: true,
      json: true,
      rss: true,
    },

    components: {
      components: [
        // 'ArtPlayer',
        'Badge',
        'BiliBili',
        // 'CodePen',

        'PDF',
        'Share',
        // 'StackBlitz',
        'SiteInfo',
        'VPBanner',
        'VPCard',
        // 'VidStack',
        // 'XiGua',
      ],
    },
    // 如果你需要 PWA。安装 @vuepress/plugin-pwa 并取消下方注释
    // pwa: {
    //   favicon: "/favicon.ico",
    //   cacheHTML: true,
    //   cacheImage: true,
    //   appendBase: true,
    //   apple: {
    //     icon: "/assets/icon/apple-icon-152.png",
    //     statusBarColor: "black",
    //   },
    //   msTile: {
    //     image: "/assets/icon/ms-icon-144.png",
    //     color: "#ffffff",
    //   },
    //   manifest: {
    //     icons: [
    //       {
    //         src: "/assets/icon/chrome-mask-512.png",
    //         sizes: "512x512",
    //         purpose: "maskable",
    //         type: "image/png",
    //       },
    //       {
    //         src: "/assets/icon/chrome-mask-192.png",
    //         sizes: "192x192",
    //         purpose: "maskable",
    //         type: "image/png",
    //       },
    //       {
    //         src: "/assets/icon/chrome-512.png",
    //         sizes: "512x512",
    //         type: "image/png",
    //       },
    //       {
    //         src: "/assets/icon/chrome-192.png",
    //         sizes: "192x192",
    //         type: "image/png",
    //       },
    //     ],
    //     shortcuts: [
    //       {
    //         name: "Demo",
    //         short_name: "Demo",
    //         url: "/demo/",
    //         icons: [
    //           {
    //             src: "/assets/icon/guide-maskable.png",
    //             sizes: "192x192",
    //             purpose: "maskable",
    //             type: "image/png",
    //           },
    //         ],
    //       },
    //     ],
    //   },
    // },
    sitemap: {
      changefreq: 'weekly',
    },
  },
})
