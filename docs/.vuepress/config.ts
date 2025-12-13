import { viteBundler } from '@vuepress/bundler-vite'
import { defineUserConfig } from 'vuepress'
import head from './head'
import theme from './theme'

export default defineUserConfig({
  base: '/',
  head,

  lang: 'zh-CN',
  title: '扑克博客',
  description: '扑克博客',

  theme,

  bundler: viteBundler({
    viteOptions: {
      css: {
        preprocessorOptions: {
          scss: {
            silenceDeprecations: ['if-function'],
          },
        },
      },
    },
  }),

  // 和 PWA 一起启用
  // shouldPrefetch: false,
})
