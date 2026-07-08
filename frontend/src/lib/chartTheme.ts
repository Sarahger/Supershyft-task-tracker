import type { ResolvedTheme } from '../contexts/ThemeContext';

export function getChartTheme(theme: ResolvedTheme) {
  if (theme === 'light') {
    return {
      tooltip: {
        backgroundColor: 'rgb(255 255 255)',
        border: '1px solid rgb(229 231 235)',
        borderRadius: '12px',
        color: 'rgb(17 24 39)',
        fontSize: '13px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)',
      },
      axisTick: 'rgb(156 163 175)',
      axisLine: 'rgb(229 231 235)',
      cursor: 'rgba(59, 130, 246, 0.06)',
    };
  }
  return {
    tooltip: {
      backgroundColor: '#252525',
      border: '1px solid #323232',
      borderRadius: '8px',
      color: '#F5F5F5',
      fontSize: '13px',
    },
    axisTick: '#71717A',
    axisLine: '#323232',
    cursor: 'rgba(255,255,255,0.04)',
  };
}
