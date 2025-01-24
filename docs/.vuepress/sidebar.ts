import { sidebar } from 'vuepress-theme-hope'

export default sidebar({
  '/posts/': [
    {
      text: '博客文章',
      icon: 'note',
      children: 'structure',
    },
  ],
  '/WinUI/': [
    {
      text: 'WinUI 文档',
      icon: 'note',
      children: 'structure',
    },
  ],
})
