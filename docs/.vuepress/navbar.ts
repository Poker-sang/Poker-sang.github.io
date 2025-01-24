import { navbar } from 'vuepress-theme-hope'

export default navbar([
  '/',
  '/article/',
  {
    text: '博客文章',
    link: '/posts/',
  },
  {
    text: 'WinUI 文档',
    link: '/WinUI/',
  },
  '/category/',
  '/star/',
  '/tag/',
  '/timeline/',
])
