/**
 * Client half of dsh-minimax-h3.
 *
 * One plain-ESM artifact loaded by the Web client module table. It registers:
 *   - settings.section            the five-part MiniMax settings page
 *   - conversation.composer.dock  the text-only balance strip
 *   - shell.overlay               the detail popover and the alert dialog
 *   - tool.call.toolview × 6      result cards for the minimax_h3_* tools
 *
 * The Host half is reached through same-origin JSON routes under
 * /dsh-minimax-h3; no Harness Client package is imported.
 */
window.__ModuleLoader__.load({
  id: 'dsh-minimax-h3',
  factory(require) {
    const React = require('react')
    const e = React.createElement
    const { useState, useEffect, useRef } = React
    let createPortal = null
    try {
      const ReactDOM = require('react-dom')
      createPortal = typeof ReactDOM?.createPortal === 'function' ? ReactDOM.createPortal : null
    } catch {
      createPortal = null
    }

    // ------------------------------------------------------------ locale

    const DICT = {
      zh: {
        nav: 'MiniMax',
        title: 'MiniMax',
        subtitle: '连接 · 模型 · 图片 · 参考图 · 视频 · 余额',
        connection: '连接',
        plan: '接入方式',
        planCn: '按量付费 · 国内',
        planGlobal: '按量付费 · 国际',
        planCustom: '自定义',
        baseUrl: 'API 地址',
        apiKey: 'API Key',
        keyPlaceholder: '留空沿用已存密钥 · 写入凭据 MINIMAX_API_KEY',
        keyConfigured: '已保存',
        keyMissing: '未配置',
        test: '测试连接',
        testing: '测试中…',
        save: '保存',
    saveSettings: '保存设置',
        saveBalance: '保存余额',
        saving: '保存中…',
        saved: '已保存',
        model: '模型',
        imageModel: '图片',
        videoModel: '视频',
        modelHint: '下拉菜单里含 image-01（旧）与 Hailuo 2.3；媒体模型不进模型选择器。',
        imageParams: '图片参数',
        ratio: '比例',
        resolution: '分辨率',
        count: '张数',
        format: '格式',
        enhance: '增强',
        imageHint: '1K/2K/4K 是面积档，实际宽高按比例换算',
        refs: '图生图参考图',
        refsHint: '1–16 张，顺序即 <Picture N>',
        refsNote: '不支持 mask；编辑接口强制提示词增强',
        addRef: '添加',
        localFile: '本地文件',
        publicUrl: '公网 URL',
        attachmentSha: '对话附件 sha256',
        lastResult: '上一条生成结果',
        remove: '移除',
        video: '视频',
        modeText: '文生视频',
        modeFrames: '首尾帧',
        modeReference: '参考生视频',
        optimize: '优化提示词',
        optimizing: '优化中…',
        promptPlaceholder: '一句话描述画面；镜头、光线、声音都可以写',
        framesHint: '首帧必填 / 尾帧可选 · 比例跟随首帧（adaptive）',
        referenceHint: '参考图 ≤9 / 视频 ≤3 / 音频 ≤3 · 总文件 ≤12',
        refImages: '参考图',
        refVideos: '参考视频',
        refAudios: '参考音频',
        audioHint: '音频不能单独使用；参考生视频与首尾帧互斥',
        firstFrame: '首帧',
        lastFrame: '尾帧',
        optional: '可选',
        balanceAlert: '余额与预警',
        source: '余额来源',
        ledger: '本地记账',
        adminKey: 'admin key',
        adminHint: '真余额需管理类密钥',
        currentBalance: '当前余额',
        priceSecond: '¥/秒',
        priceImage: '¥/张',
        bell: '余额预警',
        alertBelow: '低于',
        alertOn: '已开启',
        alertOff: '未开启',
        alertTitle: '余额预警',
        enableAlert: '开启预警',
        threshold: '阈值',
        close: '关闭',
        clearLocal: '清理本地记录',
        clearConfirm: '确认清理？',
        estimatedNote: '仅在本机提醒，不发送系统通知；触发一次后不再重复，余额回升到阈值以上会自动恢复提醒。金额为本地估算，实际以控制台账单为准。',
        detailTitle: '余额明细',
        detailSource: '来源：本地记账',
        detailSourceAdmin: '来源：admin key',
        detailBalance: '余额',
        detailSession: '本会话',
        detailByModel: '按模型明细',
        detailAlert: '余额预警',
        notTriggered: '未触发',
        triggered: '已触发',
        refresh: '刷新',
        noTasks: '本会话还没有生成记录。',
        unverified: '普通 Key 拿不到真实余额（403 admin key）；当前为本地估算。',
        openFile: '打开文件',
        copyPath: '复制路径',
        copied: '已复制',
        retryDownload: '重试下载',
        retryGenerate: '重试生成',
        confirmRetry: '确认重试？',
        asFirstFrame: '作为首帧',
        asReference: '作为参考',
        regenerate: '重新生成',
        useThis: '用这条生成',
        edit: '编辑',
        reoptimize: '重新优化',
        fetching: '取回中…',
        taskId: '任务',
        elapsed: '已用',
        generating: '生成中',
        submitting: '提交中',
        savedStatus: '已落盘',
        failedStatus: '失败',
        downloadFailed: '下载失败',
        partialStatus: '部分成功',
        nonIdempotent: '最长 600 秒；非幂等，超时不要重试（会重复计费）',
        submittedHint: '任务已提交；成片未生成前不要重复提交',
        filledDraft: '已填入输入框，发送即可继续',
        partialFailures: '部分图片失败',
        imageCount: '张',
        localOnly: '仅本机记录',
        settingsTab: '设置 → MiniMax',
        dockBalance: '余额',
        dockSession: '本会话',
        duration: '时长',
        withAudio: '带音频',
        silent: '无声',
        fetchResult: '取回结果',
        videoSubmitFailed: '提交失败',
      },
      en: {
        nav: 'MiniMax',
        title: 'MiniMax',
        subtitle: 'Connection · Models · Images · References · Video · Balance',
        connection: 'Connection',
        plan: 'Plan',
        planCn: 'Pay as you go · CN',
        planGlobal: 'Pay as you go · Global',
        planCustom: 'Custom',
        baseUrl: 'API URL',
        apiKey: 'API key',
        keyPlaceholder: 'Leave blank to keep the saved key · stored as MINIMAX_API_KEY',
        keyConfigured: 'saved',
        keyMissing: 'not set',
        test: 'Test',
        testing: 'Testing…',
        save: 'Save',
    saveSettings: 'Save settings',
        saveBalance: 'Save balance',
        saving: 'Saving…',
        saved: 'Saved',
        model: 'Models',
        imageModel: 'Image',
        videoModel: 'Video',
        modelHint: 'The menus also contain image-01 (legacy) and Hailuo 2.3; media models stay out of model routing.',
        imageParams: 'Image parameters',
        ratio: 'Ratio',
        resolution: 'Resolution',
        count: 'Count',
        format: 'Format',
        enhance: 'Enhance',
        imageHint: '1K/2K/4K are area tiers; actual pixels follow the ratio',
        refs: 'Edit references',
        refsHint: '1–16 images; order is <Picture N>',
        refsNote: 'No mask support; the edit endpoint always enhances the prompt',
        addRef: 'Add',
        localFile: 'Local file',
        publicUrl: 'Public URL',
        attachmentSha: 'Chat attachment sha256',
        lastResult: 'Last result',
        remove: 'Remove',
        video: 'Video',
        modeText: 'Text to video',
        modeFrames: 'First/last frame',
        modeReference: 'Reference to video',
        optimize: 'Enhance prompt',
        optimizing: 'Enhancing…',
        promptPlaceholder: 'Describe the shot; camera, light, and sound all welcome',
        framesHint: 'First frame required / last optional · ratio follows the first frame (adaptive)',
        referenceHint: 'Images ≤9 / videos ≤3 / audio ≤3 · files ≤12 total',
        refImages: 'Images',
        refVideos: 'Videos',
        refAudios: 'Audio',
        audioHint: 'Audio needs an image or video reference; reference mode cannot mix with frames',
        firstFrame: 'First frame',
        lastFrame: 'Last frame',
        optional: 'optional',
        balanceAlert: 'Balance and alert',
        source: 'Source',
        ledger: 'Local ledger',
        adminKey: 'admin key',
        adminHint: 'A real balance needs an admin key',
        currentBalance: 'Current balance',
        priceSecond: '¥/second',
        priceImage: '¥/image',
        bell: 'Balance alert',
        alertBelow: 'below',
        alertOn: 'on',
        alertOff: 'off',
        alertTitle: 'Balance alert',
        enableAlert: 'Enable alert',
        threshold: 'Threshold',
        close: 'Close',
        clearLocal: 'Clear local records',
        clearConfirm: 'Confirm clear?',
        estimatedNote: 'Local reminder only, with no system notification; it fires once and stays quiet until the balance recovers above the threshold. Amounts are estimates; the platform statement is authoritative.',
        detailTitle: 'Balance detail',
        detailSource: 'Source: local ledger',
        detailSourceAdmin: 'Source: admin key',
        detailBalance: 'Balance',
        detailSession: 'This session',
        detailByModel: 'By model',
        detailAlert: 'Alert',
        notTriggered: 'not triggered',
        triggered: 'triggered',
        refresh: 'Refresh',
        noTasks: 'No media tasks in this session yet.',
        unverified: 'An ordinary key cannot read the real balance (403 admin key); this is a local estimate.',
        openFile: 'Open file',
        copyPath: 'Copy path',
        copied: 'Copied',
        retryDownload: 'Retry download',
        retryGenerate: 'Retry generation',
        confirmRetry: 'Confirm retry?',
        asFirstFrame: 'Use as first frame',
        asReference: 'Use as reference',
        regenerate: 'Regenerate',
        useThis: 'Generate with this',
        edit: 'Edit',
        reoptimize: 'Enhance again',
        fetching: 'Fetching…',
        taskId: 'Task',
        elapsed: 'elapsed',
        generating: 'Generating',
        submitting: 'Submitting',
        savedStatus: 'Saved',
        failedStatus: 'Failed',
        downloadFailed: 'Download failed',
        partialStatus: 'Partially succeeded',
        nonIdempotent: 'Up to 600 s; non-idempotent, do not retry on timeout (you would be billed twice)',
        submittedHint: 'Submitted; do not resubmit before the video exists',
        filledDraft: 'Filled into the composer',
        partialFailures: 'Some images failed',
        imageCount: 'images',
        localOnly: 'local only',
        settingsTab: 'Settings → MiniMax',
        dockBalance: 'Balance',
        dockSession: 'This session',
        duration: 'Duration',
        withAudio: 'with audio',
        silent: 'silent',
        fetchResult: 'Fetch result',
        videoSubmitFailed: 'Submit failed',
      },
    }

    let activeLocale = 'zh'
    let uiLanguage = null
    function currentLanguage() {
      return uiLanguage || activeLocale
    }
    function t(key) {
      const dict = DICT[currentLanguage()] || DICT.zh
      return dict[key] ?? DICT.zh[key] ?? key
    }
    function L(zh, en) {
      return currentLanguage() === 'en' ? en : zh
    }

    // -------------------------------------------------------------- hub

    const hub = {
      states: new Map(),
      errors: new Map(),
      loading: new Set(),
      timers: new Map(),
      listeners: new Set(),
      overlay: null,
      lastSessionId: '',
      subscribe(fn) {
        this.listeners.add(fn)
        return () => this.listeners.delete(fn)
      },
      emit() {
        for (const fn of [...this.listeners]) {
          try {
            fn()
          } catch {}
        }
      },
      get(sessionId) {
        return this.states.get(String(sessionId || 'global')) || null
      },
      isLoading(sessionId) {
        return this.loading.has(String(sessionId || 'global'))
      },
      refresh(sessionId, immediate = false) {
        const key = String(sessionId || 'global')
        if (this.timers.has(key)) clearTimeout(this.timers.get(key))
        if (immediate) {
          this.timers.delete(key)
          return this.load(key)
        }
        this.timers.set(
          key,
          setTimeout(() => {
            this.timers.delete(key)
            this.load(key)
          }, 220),
        )
        return Promise.resolve()
      },
      async load(key) {
        this.loading.add(key)
        this.emit()
        try {
          const response = await fetch(`/dsh-minimax-h3/state?sessionId=${encodeURIComponent(key)}`, {
            headers: { Accept: 'application/json' },
          })
          const data = await response.json()
          if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP ${response.status}`)
          this.states.set(key, data)
          this.errors.delete(key)
        } catch (error) {
          this.errors.set(key, error instanceof Error ? error.message : String(error))
        } finally {
          this.loading.delete(key)
          this.emit()
        }
      },
      open(mode, sessionId) {
        this.overlay = { mode, sessionId: String(sessionId || 'global') }
        this.emit()
        this.refresh(sessionId, true)
      },
      close() {
        this.overlay = null
        this.emit()
      },
      markSession(sessionId) {
        if (sessionId) this.lastSessionId = String(sessionId)
      },
    }

    let openMiniMaxTab = () => {}

    function useHubTick() {
      const [, force] = useState(0)
      useEffect(() => hub.subscribe(() => force((value) => value + 1)), [])
      return hub
    }

    function useHubData(sessionId) {
      const [, force] = useState(0)
      const key = String(sessionId || 'global')
      useEffect(() => hub.subscribe(() => force((value) => value + 1)), [])
      useEffect(() => {
        hub.refresh(key, true)
      }, [key])
      return hub.get(key)
    }

    function useHubError(sessionId) {
      useHubTick()
      return hub.errors.get(String(sessionId || 'global')) || ''
    }

    // -------------------------------------------------------------- api

    async function apiPost(path, body) {
      const response = await fetch(`/dsh-minimax-h3${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      })
      let data = null
      try {
        data = await response.json()
      } catch {}
      if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP ${response.status}`)
      return data
    }

    function readFileDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(reader.error || new Error('read failed'))
        reader.onload = () => resolve(String(reader.result || ''))
        reader.readAsDataURL(file)
      })
    }

    async function copyText(text) {
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch {
        return false
      }
    }

    // ------------------------------------------------------------ helpers

    function money(value) {
      const number = Number(value) || 0
      return `¥${number.toFixed(2)}`
    }

    function bytes(value) {
      const number = Number(value) || 0
      if (number >= 1048576) return `${(number / 1048576).toFixed(1)} MB`
      return `${Math.max(1, Math.round(number / 1024))} KB`
    }

    function shortPath(value) {
      const text = String(value || '')
      const leaf = text.split(/[\\/]/).pop() || text
      return leaf.length > 26 ? `${leaf.slice(0, 23)}…` : leaf
    }

    function imagePixels(area, ratio) {
      const total = { '1K': 1024 * 1024, '2K': 2048 * 2048, '4K': 4096 * 4096 }[area]
      const match = /^(\d+):(\d+)$/.exec(String(ratio || ''))
      if (!total || !match) return null
      const a = Number(match[1])
      const b = Number(match[2])
      return {
        width: Math.floor(Math.sqrt((total * a) / b) / 16) * 16,
        height: Math.floor(Math.sqrt((total * b) / a) / 16) * 16,
      }
    }

    function videoPixels(resolution, ratio) {
      const short = { '480P': 480, '768P': 768, '2K': 1440 }[resolution]
      const match = /^(\d+):(\d+)$/.exec(String(ratio || ''))
      if (!short || !match) return null
      const a = Number(match[1])
      const b = Number(match[2])
      const long = Math.floor((short * Math.max(a, b)) / Math.min(a, b) / 32) * 32
      return a >= b ? { width: long, height: short } : { width: short, height: long }
    }

    function parseArgs(props) {
      try {
        const raw = props.block?.argsRaw || props.block?.call?.argsRaw
        return raw ? JSON.parse(raw) : {}
      } catch {
        return {}
      }
    }

    function errorText(block) {
      const parts = (block?.content || []).filter((item) => item?.type === 'text').map((item) => item.text)
      return parts.join('\n') || 'Request failed'
    }

    function insertDraft(props, text) {
      const actions = props.inputActions
      if (!actions) return
      try {
        const span = actions.captureInsertion?.()
        if (span && actions.insertText?.(text, span)) return
      } catch {}
      try {
        actions.setDraft?.(text)
      } catch {}
    }

    // --------------------------------------------------------- components

    function Btn({ children, onClick, primary, warn, danger, disabled, title, ...rest }) {
      return e(
        'button',
        {
          type: 'button',
          className: `h3-btn${primary ? ' primary' : ''}${warn ? ' warn' : ''}${danger ? ' danger' : ''}`,
          onClick,
          disabled,
          title: title || undefined,
          ...rest,
        },
        children,
      )
    }

    function Toggle({ checked, onChange }) {
      return e(
        'button',
        {
          type: 'button',
          role: 'switch',
          'aria-checked': checked ? 'true' : 'false',
          className: `h3-toggle${checked ? ' on' : ''}`,
          onClick: () => onChange(!checked),
        },
        e('span', { className: 'h3-toggle-knob' }),
      )
    }

    function Seg({ value, options, onChange }) {
      return e(
        'div',
        { className: 'h3-seg' },
        options.map((option) =>
          e(
            'button',
            {
              key: option.value,
              type: 'button',
              className: `h3-seg-btn${value === option.value ? ' on' : ''}`,
              onClick: () => onChange(option.value),
            },
            option.label,
          ),
        ),
      )
    }

    function Field({ label, children, align = 'center' }) {
      return e(
        'div',
        { className: `h3-row h3-row-${align}` },
        e('span', { className: 'h3-lab' }, label),
        e('div', { className: 'h3-ctl' }, children),
      )
    }

    function TextBox({ value, onChange, placeholder, area, rows = 2 }) {
      if (area) {
        return e('textarea', {
          className: 'h3-input h3-textarea',
          value: value || '',
          rows,
          placeholder,
          onChange: (event) => onChange(event.target.value),
        })
      }
      return e('input', {
        className: 'h3-input',
        value: value || '',
        placeholder,
        onChange: (event) => onChange(event.target.value),
      })
    }

    function NumberBox({ value, onChange, min, max, step = 1, width = 92 }) {
      return e('input', {
        className: 'h3-input',
        style: { width },
        type: 'number',
        value,
        min,
        max,
        step,
        onChange: (event) => onChange(event.target.value),
      })
    }

    const RATIO_SHAPE = {
      '9:16': [10, 18],
      '16:9': [19, 10],
      '21:9': [22, 9],
      '1:1': [14, 14],
      '4:3': [17, 13],
      '3:4': [13, 17],
    }

    const IMAGE_EXAMPLE_SETS = [
      ['雨夜霓虹街头，地面积水映着招牌与行人', '窗台打盹的橘猫，午后暖光洒在毛上'],
      ['水彩风格的城市街景，柔和纸张纹理与留白', '雨后森林小径，薄雾与逆光穿过树梢'],
      ['赛博朋克夜市，霓虹与雨滴反光交织', '极简白墙前的一束侧光，静物特写'],
    ]

    const VIDEO_EXAMPLE_SETS = [
      ['雨夜霓虹招牌，镜头缓慢向前推进', '橘猫在窗台伸腰，尾巴轻轻摆动'],
      ['窗外光线渐亮，镜头轻微手持晃动', '环绕城市夜景，延时摄影与车流'],
      ['雨滴打在霓虹招牌上，镜头推进', '猫从窗台跳下，慢动作特写'],
    ]

    const IMAGE_EXAMPLE_SETS_EN = [
      ['Rainy neon street, puddles reflecting signs', 'Orange cat dozing on a windowsill, warm light'],
      ['Watercolor city street, soft paper texture', 'Forest path after rain, mist and backlight'],
      ['Cyberpunk night market, neon and rain', 'Minimal white wall, one side light, still life'],
    ]

    const VIDEO_EXAMPLE_SETS_EN = [
      ['Rainy neon sign, camera pushes in slowly', 'Cat stretches on the windowsill, tail sways'],
      ['Window light grows, subtle handheld drift', 'Orbit the city at night, time-lapse traffic'],
      ['Rain hits the neon sign, camera pushes in', 'Cat jumps off the sill, slow motion'],
    ]

    function RatioChips({ value, onChange, disabled, extraAdaptive }) {
      const ratios = Object.keys(RATIO_SHAPE)
      return e(
        'div',
        { className: `h3-chips${disabled ? ' disabled' : ''}` },
        ratios.map((ratio) => {
          const [width, height] = RATIO_SHAPE[ratio]
          return e(
            'button',
            {
              key: ratio,
              type: 'button',
              className: `h3-chip${value === ratio ? ' on' : ''}`,
              disabled,
              onClick: () => onChange(ratio),
              title: ratio,
            },
            e(
              'span',
              { className: 'h3-chip-box' },
              e('span', { className: 'h3-chip-shape', style: { width, height } }),
            ),
            e('span', { className: 'h3-chip-lab' }, ratio),
          )
        }),
        extraAdaptive
          ? e(
              'button',
              {
                type: 'button',
                className: `h3-chip${value === 'adaptive' ? ' on' : ''}`,
                onClick: () => onChange('adaptive'),
                title: 'adaptive',
              },
              e('span', { className: 'h3-chip-box' }, e('span', { className: 'h3-chip-adaptive' }, 'A')),
              e('span', { className: 'h3-chip-lab' }, '自适应'),
            )
          : null,
      )
    }

    function SelectBox({ value, options, onChange, width = '100%' }) {
      return e(
        'select',
        {
          className: 'h3-input h3-select',
          style: { width },
          value,
          onChange: (event) => onChange(event.target.value),
        },
        options.map((option) => e('option', { key: option.value, value: option.value }, option.label)),
      )
    }

    function Spinner({ tone }) {
      return e('span', { className: `h3-spinner${tone ? ` ${tone}` : ''}`, 'aria-hidden': 'true' })
    }

    function useElapsed(startedAt) {
      const [seconds, setSeconds] = useState(() => Math.max(0, Math.round((Date.now() - (Number(startedAt) || Date.now())) / 1000)))
      useEffect(() => {
        const timer = setInterval(() => {
          setSeconds(Math.max(0, Math.round((Date.now() - (Number(startedAt) || Date.now())) / 1000)))
        }, 1000)
        return () => clearInterval(timer)
      }, [startedAt])
      return seconds
    }

    function menuArrow(event) {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return false
      const items = Array.from(event.currentTarget.querySelectorAll('button:not([disabled])'))
      if (!items.length) return false
      const current = items.indexOf(document.activeElement)
      let next = current
      if (event.key === 'Home') next = 0
      else if (event.key === 'End') next = items.length - 1
      else if (event.key === 'ArrowDown') next = current < 0 ? 0 : (current + 1) % items.length
      else next = current <= 0 ? items.length - 1 : current - 1
      items[next]?.focus?.()
      return true
    }

    function RemoveGlyph() {
      return e(
        'svg',
        { viewBox: '0 0 16 16', width: 10, height: 10, 'aria-hidden': 'true' },
        e('path', {
          d: 'M4 4l8 8M12 4l-8 8',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
        }),
      )
    }

    function VideoGlyph() {
      return e(
        'svg',
        { viewBox: '0 0 24 24', width: 26, height: 26, 'aria-hidden': 'true' },
        e('rect', { x: 3, y: 5, width: 18, height: 14, rx: 2, fill: 'none', stroke: 'currentColor', strokeWidth: 1.4 }),
        e('path', { d: 'M10 9l5 3-5 3z', fill: 'currentColor' }),
      )
    }

    function PlayGlyph() {
      return e(
        'svg',
        { viewBox: '0 0 12 12', width: 9, height: 9, 'aria-hidden': 'true' },
        e('path', { d: 'M3 2l7 4-7 4z', fill: 'currentColor' }),
      )
    }

    function WaveGlyph() {
      const bars = [4, 9, 14, 7, 17, 11, 5, 13, 8, 16, 6, 10]
      return e(
        'svg',
        { viewBox: '0 0 40 24', width: 32, height: 20, 'aria-hidden': 'true' },
        bars.map((height, index) =>
          e('rect', {
            key: index,
            x: 2 + index * 3.2,
            y: (24 - height) / 2,
            width: 1.8,
            height,
            rx: 0.9,
            fill: 'currentColor',
          }),
        ),
      )
    }

    function refMediaUrl(value) {
      if (!value) return ''
      const text = String(value)
      if (/^(https?:|data:)/i.test(text)) return text
      if (text.startsWith('sha256:')) return ''
      return `/dsh-minimax-h3/ref-file?path=${encodeURIComponent(text)}`
    }

    function refPreview(value, kind) {
      return kind === 'image' ? refMediaUrl(value) : ''
    }

    function RefSlots({ refs, max, kind, onChange, lastResults, labelled, hint }) {
      const [menu, setMenu] = useState(false)
      const [textKind, setTextKind] = useState('')
      const [text, setText] = useState('')
      const [busy, setBusy] = useState(false)
      const [problem, setProblem] = useState('')
      const inputRef = useRef(null)
      const menuRef = useRef(null)
      const values = Array.isArray(refs) ? refs : []
      const limit = Number(max) || 1

      useEffect(() => {
        if (!menu) return undefined
        const onPointerDown = (event) => {
          if (!menuRef.current?.contains(event.target)) setMenu(false)
        }
        const onKeyDown = (event) => {
          if (event.key === 'Escape') setMenu(false)
        }
        document.addEventListener('pointerdown', onPointerDown)
        window.addEventListener('keydown', onKeyDown)
        menuRef.current?.querySelector('[role="menu"] button')?.focus?.()
        return () => {
          document.removeEventListener('pointerdown', onPointerDown)
          window.removeEventListener('keydown', onKeyDown)
        }
      }, [menu])

      async function uploadFiles(files) {
        const list = Array.from(files || []).filter((file) => {
          const type = String(file.type || '')
          if (kind === 'image') return type.startsWith('image/')
          if (kind === 'video') return type.startsWith('video/')
          return type.startsWith('audio/')
        })
        if (!list.length) {
          setProblem(L('选择的文件类型不匹配', 'The selected file type does not match'))
          return
        }
        const room = limit - values.length
        if (room <= 0) return
        setBusy(true)
        setProblem('')
        try {
          const next = [...values]
          for (const file of list.slice(0, room)) {
            const data = await readFileDataUrl(file)
            const result = await apiPost('/upload-ref', {
              name: file.name,
              data,
              kind: kind === 'image' ? 'image' : 'file',
            })
            next.push(result.path)
          }
          onChange(next.slice(0, limit))
        } catch (error) {
          setProblem(error.message)
        } finally {
          setBusy(false)
          if (inputRef.current) inputRef.current.value = ''
        }
      }

      function add(value) {
        if (!value) return
        onChange([...values, value].slice(0, limit))
        setMenu(false)
        setTextKind('')
        setText('')
      }

      return e(
        'div',
        { className: `h3-refs h3-refs-${kind}` },
        e(
          'div',
          { className: `h3-ref-line${labelled ? ' labelled' : ''}` },
          e(
            'div',
            { className: `h3-ref-grid${labelled ? ' h3-ref-grid-labelled' : ''}` },
          values.map((value, index) => {
            const preview = refPreview(value, kind)
            const mediaUrl = refMediaUrl(value)
            const seekFirst = (event) => {
              try {
                event.currentTarget.currentTime = 0.01
              } catch {}
            }
            const slot = e(
              'div',
              { key: `${value}-${index}`, className: 'h3-ref-slot' },
              preview
                ? e('img', {
                    className: 'h3-ref-thumb',
                    src: preview,
                    alt: '',
                    loading: 'lazy',
                    onError: (event) => {
                      event.currentTarget.style.display = 'none'
                    },
                  })
                : null,
              kind === 'video' ? e('span', { className: 'h3-ref-media-icon' }, e(VideoGlyph)) : null,
              kind === 'video' && mediaUrl
                ? e('video', {
                    className: 'h3-ref-thumb h3-ref-video',
                    src: mediaUrl,
                    preload: 'metadata',
                    muted: true,
                    playsInline: true,
                    onLoadedMetadata: seekFirst,
                    onLoadedData: seekFirst,
                    onError: (event) => {
                      event.currentTarget.style.display = 'none'
                    },
                  })
                : null,
              kind === 'video' && mediaUrl ? e('span', { className: 'h3-ref-play' }, e(PlayGlyph)) : null,
              kind === 'video' ? e('span', { className: 'h3-ref-video-badge' }, L('视频', 'Video')) : null,
              kind === 'audio' ? e('span', { className: 'h3-ref-audio' }, e(WaveGlyph)) : null,
              kind !== 'image' && kind !== 'video' && kind !== 'audio'
                ? e('span', { className: 'h3-ref-name' }, shortPath(value))
                : null,
              e('span', { className: 'h3-ref-index' }, String(index + 1)),
              e(
                'button',
                {
                  type: 'button',
                  className: 'h3-ref-x',
                  title: t('remove'),
                  'aria-label': t('remove'),
                  onClick: () => onChange(values.filter((_, at) => at !== index)),
                },
                e(RemoveGlyph),
              ),
            )
            if (!labelled) return slot
            return e(
              'div',
              { key: `${value}-${index}`, className: 'h3-ref-card' },
              e('div', { className: 'h3-frame-lab' }, L('参考图', 'Reference')),
              slot,
            )
          }),
          values.length < limit
            ? e(
                'div',
                { className: 'h3-ref-addwrap', ref: menuRef },
                labelled
                  ? e('div', { className: 'h3-frame-lab' }, L('参考图', 'Reference'))
                  : null,
                e(
                  'button',
                  { type: 'button', className: 'h3-ref-add', onClick: () => setMenu((open) => !open), title: t('addRef'), 'aria-haspopup': 'menu', 'aria-expanded': menu },
                  busy ? e(Spinner) : '+',
                ),
                menu
                  ? e(
                      'div',
                      { className: 'h3-menu', role: 'menu', 'aria-label': t('addRef'), onKeyDown: (event) => { if (event.key === 'Escape') { setMenu(false); return } if (menuArrow(event)) event.preventDefault() } },
                      e('button', { type: 'button', role: 'menuitem', tabIndex: -1, onClick: () => { setMenu(false); inputRef.current?.click() } }, t('localFile')),
                      e('button', { type: 'button', role: 'menuitem', tabIndex: -1, onClick: () => { setMenu(false); setTextKind('url') } }, t('publicUrl')),
                      e('button', { type: 'button', role: 'menuitem', tabIndex: -1, onClick: () => { setMenu(false); setTextKind('sha') } }, t('attachmentSha')),
                      e(
                        'button',
                        {
                          type: 'button',
                          role: 'menuitem',
                          tabIndex: -1,
                          disabled: !(lastResults || []).length,
                          onClick: () => add((lastResults || [])[0]),
                        },
                        t('lastResult'),
                      ),
                    )
                  : null,
              )
            : null,
          ),
          labelled && hint ? e('span', { className: 'h3-ref-hint h3-ref-edit-hint' }, hint) : null,
        ),
        textKind
          ? e(
              'div',
              { className: 'h3-ref-text' },
              e('input', {
                className: 'h3-input',
                autoFocus: true,
                value: text,
                placeholder: textKind === 'url' ? 'https://…' : 'sha256:<hex>',
                onChange: (event) => setText(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') add(text.trim())
                },
              }),
              e(Btn, { onClick: () => add(text.trim()) }, t('addRef')),
              e(Btn, { onClick: () => setTextKind('') }, t('close')),
            )
          : null,
        problem ? e('div', { className: 'h3-msg bad' }, problem) : null,
        e('input', {
          ref: inputRef,
          type: 'file',
          style: { display: 'none' },
          accept:
            kind === 'image'
              ? 'image/jpeg,image/png,image/webp,image/heic'
              : kind === 'video'
                ? 'video/mp4,video/quicktime'
                : 'audio/mpeg,audio/wav',
          onChange: (event) => uploadFiles(event.target.files),
          multiple: true,
        }),
      )
    }

    // --------------------------------------------------------- settings

    const IMAGE_MODELS = [
      { value: 'MiniMax-H3-Image', label: 'MiniMax-H3-Image', metaZh: '4K · 1–10 张', metaEn: '4K · 1–10 images' },
      { value: 'MiniMax-H3-Image-Highspeed', label: 'MiniMax-H3-Image-Highspeed', metaZh: '高速 · 1–10 张', metaEn: 'Fast · 1–10 images' },
      { value: 'image-01', label: 'image-01', metaZh: '旧模型 · 无面积档 · ≤9 张', metaEn: 'Legacy · no area tier · ≤9 images' },
    ]
    const VIDEO_MODELS = [
      { value: 'MiniMax-H3', label: 'MiniMax-H3', metaZh: '4–15s · 带音频', metaEn: '4–15s · audio' },
      { value: 'MiniMax-H3-Highspeed', label: 'MiniMax-H3-Highspeed', metaZh: '480P/768P', metaEn: '480P/768P' },
      { value: 'MiniMax-H3-Lite', label: 'MiniMax-H3-Lite', metaZh: '480P/768P · 需固定比例', metaEn: '480P/768P · fixed ratio' },
      { value: 'MiniMax-H3-Max', label: 'MiniMax-H3-Max', metaZh: '5–15s · 极速', metaEn: '5–15s · fast' },
      { value: 'MiniMax-Hailuo-2.3', label: 'MiniMax-Hailuo-2.3', metaZh: '6/10s · 16:9', metaEn: '6/10s · 16:9' },
    ]

    function SettingsPage({ sessionId } = {}) {
      const sessionKey = String(sessionId || hub.lastSessionId || 'global')
      const data = useHubData(sessionKey)
      const hubError = useHubError(sessionKey)
      const language = data?.settings?.ui?.language
      if (language === 'zh' || language === 'en') uiLanguage = language
      const [draft, setDraft] = useState(null)
      const [apiKey, setApiKey] = useState('')
      const [keyInfo, setKeyInfo] = useState(null)
      const [busy, setBusy] = useState('')
      const [message, setMessage] = useState(null)
      const [clearArmed, setClearArmed] = useState(false)
      const [balanceOpen, setBalanceOpen] = useState(false)
      const initialized = useRef(false)

      useEffect(() => {
        if (!initialized.current && data?.settings) {
          setDraft(data.settings)
          setKeyInfo(data.key || null)
          initialized.current = true
        }
      }, [data])

      // Keep balance/alert fields in step with saves made by the alert dialog
      // or the balance button, without clobbering unrelated unsaved edits.
      useEffect(() => {
        const settings = data?.settings
        if (!settings) return
        setDraft((current) =>
          current
            ? {
                ...current,
                balance: settings.balance,
                alert: settings.alert,
                pricing: settings.pricing,
              }
            : current,
        )
      }, [data?.settings?.balance?.current, data?.settings?.alert?.enabled, data?.settings?.alert?.threshold, data?.settings?.pricing?.videoPerSecond, data?.settings?.pricing?.imagePerCall])

      if (!draft) {
        return e(
          'div',
          { className: 'h3 h3-settings' },
          e(StyleTag),
          e(
            'div',
            { className: 'h3-empty' },
            data
              ? e(Spinner)
              : hubError
                ? e(
                    React.Fragment,
                    null,
                    e('b', null, L('加载失败', 'Load failed')),
                    e('span', null, hubError),
                    e(Btn, { primary: true, onClick: () => hub.refresh(sessionKey, true) }, L('重试', 'Retry')),
                  )
                : '…',
          ),
        )
      }

      function patch(section, values) {
        setDraft((current) => ({ ...current, [section]: { ...current[section], ...values } }))
      }

      function changeImageModel(value) {
        setDraft((current) => {
          const image = { ...current.image, ...(value === 'image-01' ? { area: '1K', n: Math.min(current.image.n, 9), format: 'jpeg' } : {}) }
          return { ...current, models: { ...current.models, image: value }, image }
        })
      }

      function changeVideoModel(value) {
        setDraft((current) => {
          const video = { ...current.video, ...(value === 'MiniMax-Hailuo-2.3' ? { duration: 6, resolution: '768P', ratio: '16:9', mode: 'text' } : {}) }
          if (value !== 'MiniMax-Hailuo-2.3' && video.duration < 4) video.duration = 4
          if (value === 'MiniMax-H3-Lite' && video.ratio === 'adaptive') video.ratio = '16:9'
          return { ...current, models: { ...current.models, video: value }, video }
        })
      }

      async function save() {
        if (!draft.connection.baseURL.trim()) {
          setMessage({ ok: false, text: L('API 地址不能为空。', 'API base URL cannot be empty.') })
          return
        }
        setBusy('save')
        setMessage(null)
        try {
          const payload = {
            sessionId: sessionKey,
            settings: { ...draft },
          }
          if (apiKey.trim()) payload.apiKey = apiKey.trim()
          const result = await apiPost('/settings', payload)
          setDraft(result.settings)
          setKeyInfo(result.key || keyInfo)
          setApiKey('')
          const nextLanguage = result.settings?.ui?.language
          if (nextLanguage === 'zh' || nextLanguage === 'en') uiLanguage = nextLanguage
          await hub.refresh(sessionKey, true)
          setMessage({ ok: true, text: t('saved') })
        } catch (error) {
          setMessage({ ok: false, text: error.message })
        } finally {
          setBusy('')
        }
      }

      async function testConnection() {
        setBusy('test')
        setMessage(null)
        try {
          const result = await apiPost('/test', { connection: draft.connection, apiKey: apiKey.trim() || undefined })
          setMessage({ ok: Boolean(result.ok), text: result.ok ? result.message : `${result.message}${result.hint ? ` — ${result.hint}` : ''}` })
        } catch (error) {
          setMessage({ ok: false, text: error.message })
        } finally {
          setBusy('')
        }
      }

      async function clearLocal() {
        if (!clearArmed) {
          setClearArmed(true)
          return
        }
        setBusy('clear')
        try {
          await apiPost('/action', { action: 'clear-local', sessionId: sessionKey })
          setMessage({ ok: true, text: t('clearLocal') })
          setClearArmed(false)
          await hub.refresh(sessionKey, true)
        } catch (error) {
          setMessage({ ok: false, text: error.message })
        } finally {
          setBusy('')
        }
      }

      const messageView = message
        ? e('div', { className: `h3-msg ${message.ok ? 'good' : 'bad'}`, role: 'status' }, message.text)
        : null

      return e(
        'div',
        { className: 'h3 h3-settings h3-settingspage' },
        e(StyleTag),
        e(
          'div',
          { className: 'h3-settings-scroll' },
          e('div', { className: 'h3-title' }, t('title')),
          e('div', { className: 'h3-sub' }, t('subtitle')),
          e(
            'div',
            { className: `h3-statuscard${keyInfo?.configured ? '' : ' warn'}` },
            e('span', { className: `h3-dot${keyInfo?.configured ? '' : ' warn'}` }),
            e(
              'div',
              { className: 'h3-statusmain' },
              e('b', null, keyInfo?.configured ? L('API 已配置', 'API configured') : L('API 未配置', 'API not configured')),
              e('span', null, draft.connection.baseURL),
            ),
            e('span', { className: 'h3-statusmeta' }, keyInfo?.masked || ''),
          ),
          e(
            'section',
            { className: 'h3-formcard' },
            e(
              'div',
              { className: 'h3-formcardhead' },
              e('b', null, t('connection')),
              e('span', null, 'Base URL / API Key'),
            ),
            e(
              'div',
              { className: 'h3-formcardbody' },
              e(
                Field,
                { label: t('plan') },
                e(Seg, {
                  value: draft.connection.plan,
                  options: [
                    { value: 'payg-cn', label: t('planCn') },
                    { value: 'payg-global', label: t('planGlobal') },
                    { value: 'custom', label: t('planCustom') },
                  ],
                  onChange: (value) => patch('connection', { plan: value }),
                }),
              ),
              e(
                Field,
                { label: t('baseUrl') },
                e(TextBox, { value: draft.connection.baseURL, onChange: (value) => patch('connection', { baseURL: value }) }),
              ),
              e(
                Field,
                { label: t('apiKey') },
                e(
                  'div',
                  { className: `h3-keyline${keyInfo?.configured ? ' saved' : ''}` },
                  e(TextBox, {
                    value: apiKey,
                    onChange: setApiKey,
                    placeholder: keyInfo?.configured
                      ? `${t('keyConfigured')}${keyInfo.masked ? ` ${keyInfo.masked}` : ''}`
                      : t('keyPlaceholder'),
                  }),
                ),
              ),
              e(
                'div',
                { className: 'h3-actions' },
                e(Btn, { onClick: testConnection, disabled: Boolean(busy) }, busy === 'test' ? t('testing') : t('test')),
              ),
            ),
          ),
          e(
            'section',
            { className: 'h3-formcard' },
            e(
              'div',
              { className: 'h3-formcardhead' },
              e('b', null, L('语言', 'Language')),
              e('span', null, L('显示语言', 'Display language')),
            ),
            e(
              'div',
              { className: 'h3-formcardbody' },
              e(
                Field,
                { label: L('界面语言', 'Language') },
                e(Seg, {
                  value: draft.ui?.language === 'en' ? 'en' : 'zh',
                  options: [
                    { value: 'zh', label: '中文' },
                    { value: 'en', label: 'English' },
                  ],
                  onChange: (value) => patch('ui', { language: value }),
                }),
              ),
            ),
          ),
          e(
            'section',
            { className: 'h3-formcard' },
            e(
              'div',
              { className: 'h3-formcardhead' },
              e('b', null, t('model')),
              e('span', null, L('图片 / 视频默认模型', 'Default image / video models')),
            ),
            e(
              'div',
              { className: 'h3-formcardbody' },
              e(
                Field,
                { label: t('imageModel') },
                e(SelectBox, {
                  value: draft.models.image,
                  options: IMAGE_MODELS.map((model) => ({ value: model.value, label: `${model.label}    ${L(model.metaZh, model.metaEn)}` })),
                  onChange: changeImageModel,
                }),
              ),
              e(
                Field,
                { label: t('videoModel') },
                e(SelectBox, {
                  value: draft.models.video,
                  options: VIDEO_MODELS.map((model) => ({ value: model.value, label: `${model.label}    ${L(model.metaZh, model.metaEn)}` })),
                  onChange: changeVideoModel,
                }),
              ),
              e('div', { className: 'h3-note' }, t('modelHint')),
            ),
          ),
          e(
            'section',
            { className: 'h3-formcard' },
            e(
              'div',
              { className: 'h3-formcardhead' },
              e('b', null, t('balanceAlert')),
              e('span', null, L('本地估算与提醒', 'Local estimates and alerts')),
            ),
            e(
              'div',
              { className: 'h3-formcardbody' },
              e(
                Field,
                { label: t('source') },
                e(
                  'div',
                  { className: 'h3-inline' },
                  e(Seg, {
                    value: draft.balance.source,
                    options: [
                      { value: 'ledger', label: t('ledger') },
                      { value: 'admin-key', label: t('adminKey') },
                    ],
                    onChange: (value) => patch('balance', { source: value }),
                  }),
                  e('span', { className: 'h3-hint' }, t('adminHint')),
                ),
              ),
              e(
                Field,
                { label: L('单价', 'Unit price') },
                e(
                  'div',
                  { className: 'h3-inline' },
                  e(NumberBox, { value: draft.pricing.videoPerSecond, onChange: (value) => patch('pricing', { videoPerSecond: Number(value) }), step: '0.01', width: 74 }),
                  e('span', { className: 'h3-inline-lab' }, t('priceSecond')),
                  e(NumberBox, { value: draft.pricing.imagePerCall, onChange: (value) => patch('pricing', { imagePerCall: Number(value) }), step: '0.01', width: 74 }),
                  e('span', { className: 'h3-inline-lab' }, t('priceImage')),
                ),
              ),
              e(
                'div',
                { className: 'h3-alertbar' },
                e(
                  'button',
                  { type: 'button', className: 'h3-bell', title: t('bell'), onClick: () => setBalanceOpen((open) => !open) },
                  e(BellIcon),
                ),
                e('span', { className: 'h3-alertname' }, t('bell')),
                e(
                  'span',
                  { className: `h3-alertstate ${draft.alert.enabled ? 'on' : ''}` },
                  draft.alert.enabled ? `${t('alertBelow')} ${money(draft.alert.threshold)}` : t('alertOff'),
                ),
                e(
                  Btn,
                  { onClick: () => setBalanceOpen((open) => !open) },
                  balanceOpen ? L('收起余额', 'Collapse balance') : L('设置预警', 'Set alert'),
                ),
              ),
              balanceOpen
                ? e(
                    'div',
                    { className: 'h3-balance-expand' },
                    e(BalancePanel, { sessionId: sessionKey, data }),
                  )
                : null,
              e(
                'div',
                { className: 'h3-actions' },
                e(Btn, { danger: true, onClick: clearLocal, disabled: Boolean(busy) }, clearArmed ? t('clearConfirm') : t('clearLocal')),
              ),
            ),
          ),
        ),
        e(
          'div',
          { className: 'h3-settingsfoot' },
          messageView || e('span', { className: 'h3-hint' }, L('修改后点击保存', 'Save after editing')),
          e(Btn, { primary: true, onClick: save, disabled: Boolean(busy) }, busy === 'save' ? t('saving') : t('saveSettings')),
        ),
      )

    }

    function ImageModes({ mode, onChange }) {
      const items = [
        { value: 'text', label: L('文生图', 'Text to image') },
        { value: 'edit', label: L('图生图', 'Image edit') },
      ]
      return e(
        'div',
        { className: 'h3-modes' },
        items.map((item, index) =>
          e(
            'span',
            { key: item.value, className: 'h3-mode-wrap' },
            index ? e('span', { className: 'h3-mode-sep' }) : null,
            item.value === mode
              ? e('span', { className: 'h3-mode-pill' }, item.label)
              : e('button', { type: 'button', className: 'h3-mode-link', onClick: () => onChange(item.value) }, item.label),
          ),
        ),
      )
    }

    function VideoModes({ mode, onChange }) {
      const items = [
        { value: 'text', label: t('modeText') },
        { value: 'frames', label: t('modeFrames') },
        { value: 'reference', label: t('modeReference') },
      ]
      return e(
        'div',
        { className: 'h3-modes' },
        items.map((item, index) =>
          e(
            'span',
            { key: item.value, className: 'h3-mode-wrap' },
            index ? e('span', { className: 'h3-mode-sep' }) : null,
            item.value === mode
              ? e('span', { className: 'h3-mode-pill' }, item.label)
              : e('button', { type: 'button', className: 'h3-mode-link', onClick: () => onChange(item.value) }, item.label),
          ),
        ),
      )
    }

    function FrameSlot({ label, value, onChange }) {
      const inputRef = useRef(null)
      const [busy, setBusy] = useState(false)
      const [problem, setProblem] = useState('')
      async function upload(file) {
        if (!file) return
        if (!String(file.type || '').startsWith('image/')) {
          setProblem(L('请选择图片文件', 'Please choose an image file'))
          return
        }
        setBusy(true)
        setProblem('')
        try {
          const data = await readFileDataUrl(file)
          const result = await apiPost('/upload-ref', { name: file.name, data, kind: 'image' })
          onChange(result.path)
        } catch (error) {
          setProblem(error.message)
        } finally {
          setBusy(false)
          if (inputRef.current) inputRef.current.value = ''
        }
      }
      return e(
        'div',
        { className: 'h3-frame' },
        e('div', { className: 'h3-frame-lab' }, label),
        value
          ? e(
              'div',
              { className: 'h3-frame-filled' },
              e('img', {
                className: 'h3-ref-thumb',
                src: refPreview(value, 'image'),
                alt: '',
                loading: 'lazy',
                onError: (event) => {
                  event.currentTarget.style.display = 'none'
                },
              }),
              e(
                'button',
                { type: 'button', className: 'h3-ref-x', title: t('remove'), 'aria-label': t('remove'), onClick: () => onChange('') },
                e(RemoveGlyph),
              ),
            )
          : e(
              'button',
              { type: 'button', className: 'h3-frame-add', onClick: () => inputRef.current?.click(), title: L('点击选择图片', 'Click to choose an image') },
              busy ? e(Spinner) : '+',
            ),
        problem ? e('div', { className: 'h3-msg bad' }, problem) : null,
        e('input', { ref: inputRef, type: 'file', accept: 'image/*', style: { display: 'none' }, onChange: (event) => upload(event.target.files?.[0]) }),
      )
    }

    function BellIcon() {
      return e(
        'svg',
        { viewBox: '0 0 20 20', width: 18, height: 18, 'aria-hidden': 'true', style: { transform: 'scale(.85,.95)' } },
        e('path', {
          d: 'M12 3 C12 1.9 11.1 1 10 1 C8.9 1 8 1.9 8 3 C5.8 3.6 4.5 5.5 4.5 8 L4.5 10.5 L3 12 L17 12 L15.5 10.5 L15.5 8 C15.5 5.5 14.2 3.6 12 3 Z',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.2,
        }),
        e('circle', { cx: 10, cy: 13.1, r: 1.1, fill: 'currentColor' }),
      )
    }

    // -------------------------------------------------------------- dock

    function Dock(props) {
      const sessionId = String(props.sessionId || 'global')
      const data = useHubData(sessionId)
      useEffect(() => {
        hub.markSession(sessionId)
      }, [sessionId])
      if (!data) return null
      const balance = data.balance
      const warn = Boolean(balance.alert?.triggered)
      return e(
        React.Fragment,
        null,
        e(StyleTag),
        e(
          'div',
          {
            className: `h3-dock${warn ? ' warn' : ''}`,
            onClick: () => hub.open('detail', sessionId),
            title: `${t('title')} · ${t('unverified')}`,
            role: 'button',
            tabIndex: 0,
            onKeyDown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') hub.open('detail', sessionId)
            },
          },
          e('span', { className: 'h3-dot' }),
          e('span', { className: 'h3-dock-brand' }, 'MiniMax'),
          e(
            'span',
            { className: 'h3-dock-text' },
            `${t('dockBalance')} `,
            e('b', null, money(balance.current)),
            `·${t('dockSession')} `,
            e('b', null, money(balance.sessionSpend)),
            warn ? `·低于预警 ${money(balance.alert.threshold)}` : '',
          ),
        ),
      )
    }

    // ----------------------------------------------------------- overlay

    function Overlay() {
      const tick = useHubTick()
      const overlay = tick.overlay
      if (!overlay) return null
      return overlay.mode === 'alert'
        ? e(AlertDialog, { sessionId: overlay.sessionId })
        : e(DetailPopover, { sessionId: overlay.sessionId })
    }

    function OverlayFrame({ children, center, onClose }) {
      useEffect(() => {
        const onKey = (event) => {
          if (event.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [onClose])
      const tree = e(
        'div',
        { className: 'h3' },
        e(StyleTag),
        e('div', { className: `h3-back${center ? ' dim' : ''}`, onClick: onClose }),
        children,
      )
      return createPortal ? createPortal(tree, document.body) : tree
    }
    function DetailPopover({ sessionId }) {
      const data = useHubData(sessionId)
      const balance = data?.balance
      return e(
        OverlayFrame,
        { onClose: () => hub.close() },
        e(
          'div',
          { className: 'h3-pop', role: 'dialog', 'aria-label': t('detailTitle') },
          e(
            'div',
            { className: 'h3-pop-head' },
            e('span', { className: 'h3-pop-title' }, t('detailTitle')),
            e('span', { className: 'h3-hint' }, balance?.source === 'admin-key' ? t('detailSourceAdmin') : t('detailSource')),
          ),
          e(
            'div',
            { className: 'h3-pop-row big' },
            e('span', null, t('detailBalance')),
            e('b', null, money(balance?.current ?? 0)),
          ),
          e(
            'div',
            { className: 'h3-pop-row' },
            e('span', null, t('detailSession')),
            e('span', { className: 'h3-pop-value' }, money(balance?.sessionSpend ?? 0)),
          ),
          e('div', { className: 'h3-divider' }),
          (balance?.byModel || []).length
            ? balance.byModel.map((row) =>
                e(
                  'div',
                  { key: row.model, className: 'h3-pop-row' },
                  e('span', null, row.model),
                  e('span', { className: 'h3-hint' }, `${row.count} · ${row.seconds ? `${row.seconds}s` : `${row.images} 张`}`),
                  e('span', { className: 'h3-pop-value' }, money(row.cost)),
                ),
              )
            : e('div', { className: 'h3-hint' }, t('noTasks')),
          e('div', { className: 'h3-divider' }),
          e(
            'div',
            { className: 'h3-pop-row' },
            e('span', null, t('detailAlert')),
            e(
              'span',
              { className: `h3-hint ${balance?.alert?.triggered ? 'warn' : ''}` },
              balance?.alert?.enabled
                ? `${t('alertBelow')} ${money(balance.alert.threshold)} · ${balance.alert.triggered ? t('triggered') : t('notTriggered')}`
                : t('alertOff'),
            ),
          ),
          e('div', { className: 'h3-note' }, t('estimatedNote')),
          balance?.liveError
            ? e('div', { className: 'h3-msg bad' }, `${balance.liveError.message}${balance.liveError.hint ? ` — ${balance.liveError.hint}` : ''}`)
            : null,
          e(
            'div',
            { className: 'h3-actions end' },
            e(Btn, { onClick: () => hub.refresh(sessionId, true) }, t('refresh')),
            e(Btn, { primary: true, onClick: () => hub.close() }, t('close')),
          ),
        ),
      )
    }

    function AlertDialog({ sessionId }) {
      const data = useHubData(sessionId)
      const settings = data?.settings
      const [enabled, setEnabled] = useState(Boolean(settings?.alert?.enabled))
      const [threshold, setThreshold] = useState(String(settings?.alert?.threshold ?? 5))
      const [busy, setBusy] = useState(false)
      const [problem, setProblem] = useState('')
      useEffect(() => {
        if (settings?.alert) {
          setEnabled(Boolean(settings.alert.enabled))
          setThreshold(String(settings.alert.threshold ?? 5))
        }
      }, [settings?.alert?.enabled, settings?.alert?.threshold])
      async function save() {
        setBusy(true)
        setProblem('')
        try {
          await apiPost('/balance', { sessionId, enabled, threshold: Number(threshold) })
          await hub.refresh(sessionId, true)
          hub.close()
        } catch (error) {
          setProblem(error.message)
        } finally {
          setBusy(false)
        }
      }
      return e(
        OverlayFrame,
        { center: true, onClose: () => hub.close() },
        e(
          'div',
          { className: 'h3-dialog', role: 'dialog', 'aria-label': t('alertTitle') },
          e('div', { className: 'h3-pop-title' }, t('alertTitle')),
          e(
            'div',
            { className: 'h3-dialog-row' },
            e('span', null, t('enableAlert')),
            e(Toggle, { checked: enabled, onChange: setEnabled }),
          ),
          e(
            'div',
            { className: 'h3-dialog-row' },
            e('span', null, t('threshold')),
            e(NumberBox, { value: threshold, onChange: setThreshold, step: '0.01', width: 100 }),
          ),
          e('div', { className: 'h3-note' }, t('estimatedNote')),
          problem ? e('div', { className: 'h3-msg bad' }, problem) : null,
          e(
            'div',
            { className: 'h3-actions end' },
            e(Btn, { onClick: () => hub.close() }, t('close')),
            e(Btn, { primary: true, onClick: save, disabled: busy }, busy ? t('saving') : t('save')),
          ),
        ),
      )
    }

    // ------------------------------------------------------------- cards

    function CardFrame({ title, tone, children, footer }) {
      return e(
        React.Fragment,
        null,
        e(StyleTag),
        e(
          'div',
          { className: `h3-card${tone ? ` ${tone}` : ''}` },
          title ? e('div', { className: 'h3-card-title' }, title) : null,
          children,
          footer ? e('div', { className: 'h3-actions' }, footer) : null,
        ),
      )
    }

    function ProgressCard({ title, note, startedAt, warn, children }) {
      const elapsed = useElapsed(startedAt)
      return e(
        CardFrame,
        { title },
        e('div', { className: 'h3-progress' }, e('span', { className: 'h3-progress-bar' })),
        e('div', { className: 'h3-card-line' }, `${note || ''}${note ? ' · ' : ''}${t('elapsed')} ${elapsed} 秒`),
        warn ? e('div', { className: 'h3-card-warn' }, t('nonIdempotent')) : null,
        children,
      )
    }

    function useTaskActions(props) {
      const sessionId = String(props.sessionId || 'global')
      const [task, setTask] = useState(null)
      const [busy, setBusy] = useState('')
      const [notice, setNotice] = useState('')
      async function run(label, path, body) {
        setBusy(label)
        setNotice('')
        try {
          const result = await apiPost(path, { sessionId, ...body })
          if (result.task) setTask(result.task)
          await hub.refresh(sessionId)
          return result
        } catch (error) {
          setNotice(error.message)
          return null
        } finally {
          setBusy('')
        }
      }
      return { sessionId, task, setTask, busy, notice, setNotice, run }
    }

    function ImageCard(props) {
      const meta = props.phase === 'result' ? props.block?.meta : null
      const isError = props.phase === 'result' && props.block?.isError
      const args = parseArgs(props)
      const { task: localTask, busy, notice, setNotice, run } = useTaskActions(props)
      const [confirmRetry, setConfirmRetry] = useState(false)
      const task = localTask || meta?.task

      if (isError) {
        return e(
          ErrorCard,
          {
            title: `MiniMax H3 · ${args.model || ''}`,
            text: errorText(props.block),
            action: confirmRetry
              ? e(
                  Btn,
                  {
                    warn: true,
                    onClick: () => {
                      props.inputActions?.setDraft?.(args.prompt || '')
                      setNotice(t('filledDraft'))
                      setConfirmRetry(false)
                    },
                  },
                  t('confirmRetry'),
                )
              : null,
            secondary: e(
              Btn,
              {
                onClick: () => {
                  if (!confirmRetry) return setConfirmRetry(true)
                  props.inputActions?.setDraft?.(args.prompt || '')
                  setNotice(t('filledDraft'))
                  setConfirmRetry(false)
                },
              },
              t('retryGenerate'),
            ),
            notice,
          },
        )
      }

      if (!task) {
        return e(ProgressCard, {
          title: `MiniMax H3 · ${args.area || '1K'} · ${args.n || 1} 张`,
          note: '同步请求中',
          startedAt: props.block?.time,
          warn: true,
        })
      }

      if (task.status === 'failed' || task.status === 'submission-unknown') {
        return e(
          ErrorCard,
          {
            title: `${task.model} · ${t('failedStatus')}`,
            text: `${task.error?.message || ''}${task.error?.hint ? `\n${task.error.hint}` : ''}`,
            action: confirmRetry
              ? e(
                  Btn,
                  {
                    warn: true,
                    disabled: Boolean(busy),
                    onClick: async () => {
                      await run('retry', '/action', { action: 'regenerate', taskId: task.id })
                      setConfirmRetry(false)
                    },
                  },
                  busy ? '…' : t('confirmRetry'),
                )
              : null,
            secondary: e(Btn, { onClick: () => setConfirmRetry(true) }, t('retryGenerate')),
            notice,
          },
        )
      }

      const files = task.files || []
      return e(
        CardFrame,
        { title: `${task.model} · ${files.length} ${t('imageCount')}${task.status === 'partial' ? ` · ${t('partialStatus')}` : ''}` },
        e(
          'div',
          { className: 'h3-thumbs' },
          files.map((file) =>
            e(
              'a',
              { key: file.name, className: 'h3-thumb', href: file.url, target: '_blank', rel: 'noreferrer', title: file.path },
              e('img', { src: file.url, alt: file.name, loading: 'lazy' }),
              e('span', { className: 'h3-thumb-cap' }, `${file.width || '?'}×${file.height || '?'}`),
            ),
          ),
        ),
        e('div', { className: 'h3-card-line' }, files.map((file) => file.name).join(' · '), '  ', files[0] ? bytes(files[0].bytes) : ''),
        task.failures?.length
          ? e('div', { className: 'h3-card-warn' }, `${t('partialFailures')}：${task.failures.map((failure) => `#${failure.index + 1} ${failure.code}`).join(' ')}`)
          : null,
        e('div', { className: 'h3-card-line' }, `${money(task.cost)} · ${t('localOnly')}`),
        e(
          'div',
          { className: 'h3-actions' },
          e(
            Btn,
            {
              onClick: async () => {
                const file = files[0]
                if (!file) return
                await run('select', '/action', { action: 'select', kind: 'firstFrame', path: file.path })
                insertDraft(props, `\n[首帧已选：${file.path}]`)
                setNotice(t('filledDraft'))
              },
            },
            t('asFirstFrame'),
          ),
          e(
            Btn,
            {
              onClick: async () => {
                const file = files[0]
                if (!file) return
                await run('select', '/action', { action: 'select', kind: 'reference', path: file.path })
                insertDraft(props, `\n[参考图已选：${file.path}]`)
                setNotice(t('filledDraft'))
              },
            },
            t('asReference'),
          ),
          e(
            Btn,
            {
              disabled: Boolean(busy),
              onClick: () => run('regen', '/action', { action: 'regenerate', taskId: task.id }),
            },
            busy === 'regen' ? '…' : t('regenerate'),
          ),
        ),
        notice ? e('div', { className: 'h3-msg' }, notice) : null,
      )
    }

    function VideoCard(props) {
      const meta = props.phase === 'result' ? props.block?.meta : null
      const isError = props.phase === 'result' && props.block?.isError
      const args = parseArgs(props)
      const { sessionId, task: localTask, busy, notice, setNotice, run } = useTaskActions(props)
      const task = localTask || meta?.task

      async function fetchResult() {
        if (!task?.provider?.taskId) return
        await run('status', '/action', { action: 'status', taskId: task.id })
      }
      async function retryDownload() {
        if (!task) return
        await run('download', '/action', { action: 'download', taskId: task.id })
      }
      async function openFile() {
        const file = task?.files?.[0]
        if (!file) return
        try {
          await apiPost('/action', { action: 'open', path: file.path, sessionId })
        } catch (error) {
          setNotice(error.message)
        }
      }
      async function copyPath() {
        const file = task?.files?.[0]
        if (!file) return
        setNotice((await copyText(file.path)) ? t('copied') : file.path)
      }

      if (isError) {
        return e(ErrorCard, {
          title: `MiniMax 视频 · ${t('videoSubmitFailed')}`,
          text: errorText(props.block),
          secondary: e(Btn, { onClick: () => props.inputActions?.setDraft?.(args.prompt || '') }, t('retryGenerate')),
          notice,
        })
      }
      if (!task) {
        return e(ProgressCard, {
          title: `MiniMax ${args.model || 'H3'} · ${args.duration || '?'}s`,
          note: t('submitting'),
          startedAt: props.block?.time,
        })
      }
      if (['generating', 'queued', 'polling', 'downloading'].includes(task.status)) {
        return e(
          ProgressCard,
          {
            title: `${task.model} · ${task.params?.duration}s · ${task.params?.resolution} · ${task.params?.ratio}`,
            note: `${t('generating')} · ${t('taskId')} ${task.provider?.taskId || task.id}`,
            startedAt: props.block?.time,
          },
          e(
            'div',
            { className: 'h3-actions' },
            e(Btn, { primary: true, disabled: Boolean(busy), onClick: fetchResult }, busy === 'status' ? t('fetching') : t('fetchResult')),
          ),
          e('div', { className: 'h3-note' }, t('submittedHint')),
          notice ? e('div', { className: 'h3-msg' }, notice) : null,
        )
      }
      if (task.status === 'download-failed') {
        return e(
          CardFrame,
          { title: `${task.model} · ${t('downloadFailed')}`, tone: 'warn' },
          e('div', { className: 'h3-card-line' }, task.error?.message || ''),
          e('div', { className: 'h3-card-line' }, '成片已生成，未重复计费；可只重试下载。'),
          e('div', { className: 'h3-actions' }, e(Btn, { warn: true, disabled: Boolean(busy), onClick: retryDownload }, busy === 'download' ? '…' : t('retryDownload'))),
          notice ? e('div', { className: 'h3-msg' }, notice) : null,
        )
      }
      if (task.status === 'failed' || task.status === 'submission-unknown') {
        return e(
          CardFrame,
          { title: `${task.model} · ${t('failedStatus')}`, tone: 'warn' },
          e('div', { className: 'h3-card-line' }, task.error?.message || ''),
          task.error?.hint ? e('div', { className: 'h3-card-warn' }, task.error.hint) : null,
          e(
            'div',
            { className: 'h3-actions' },
            task.provider?.contentUrl
              ? e(Btn, { warn: true, disabled: Boolean(busy), onClick: retryDownload }, busy === 'download' ? '…' : t('retryDownload'))
              : e(Btn, { onClick: () => props.inputActions?.setDraft?.(task.prompt || '') }, t('retryGenerate')),
          ),
          notice ? e('div', { className: 'h3-msg' }, notice) : null,
        )
      }
      const file = task.files?.[0]
      return e(
        CardFrame,
        null,
        e(
          'div',
          { className: 'h3-videorow' },
          e(
            'button',
            { type: 'button', className: 'h3-videotile', onClick: openFile, title: t('openFile') },
            e('span', { className: 'h3-play' }),
          ),
          e(
            'div',
            { className: 'h3-videoinfo' },
            e('div', { className: 'h3-card-title' }, file ? shortPath(file.name) : 'result.mp4'),
            e(
              'div',
              { className: 'h3-card-line' },
              `${task.params?.duration || '?'} 秒 · ${task.params?.resolution || ''} · ${task.params?.ratio || ''} · ${task.params?.audio ? t('withAudio') : t('silent')}`,
            ),
            e('div', { className: 'h3-card-line' }, file ? bytes(file.bytes) : ''),
            e(
              'div',
              { className: 'h3-actions' },
              e(Btn, { primary: true, onClick: openFile }, t('openFile')),
              e(Btn, { onClick: copyPath }, t('copyPath')),
            ),
          ),
        ),
        notice ? e('div', { className: 'h3-msg' }, notice) : null,
      )
    }

    function EnhanceCard(props) {
      const meta = props.phase === 'result' ? props.block?.meta : null
      const isError = props.phase === 'result' && props.block?.isError
      if (isError) {
        return e(ErrorCard, { title: '提示词增强 · 失败', text: errorText(props.block), action: null, secondary: null })
      }
      const task = meta?.task
      if (!task) {
        return e(ProgressCard, {
          title: 'H3-Context-IR · 提示词增强',
          note: '轮询任务中',
          startedAt: props.block?.time,
        })
      }
      const prompt = task.enhance?.prompt || task.prompt || ''
      const sections = task.enhance || {}
      return e(
        CardFrame,
        { title: '提示词已增强 · H3-Context-IR', tone: 'info' },
        e('div', { className: 'h3-card-line' }, (sections.integrated_multimodal_description || prompt).slice(0, 240)),
        sections.overall_soundscape
          ? e('div', { className: 'h3-card-line dim' }, `overall_soundscape: ${sections.overall_soundscape.slice(0, 120)}`)
          : null,
        sections.non_diegetic_music
          ? e('div', { className: 'h3-card-line dim' }, `non_diegetic_music: ${sections.non_diegetic_music.slice(0, 120)}`)
          : null,
        e(
          'div',
          { className: 'h3-actions' },
          e(Btn, { primary: true, onClick: () => props.inputActions?.setDraft?.(prompt) }, t('useThis')),
          e(Btn, { onClick: () => props.inputActions?.setDraft?.(prompt) }, t('edit')),
          e(Btn, { onClick: () => props.inputActions?.setDraft?.(prompt) }, t('reoptimize')),
        ),
      )
    }

    function StatusCard(props) {
      const meta = props.phase === 'result' ? props.block?.meta : null
      const task = meta?.task
      if (!task) {
        return e(ProgressCard, { title: 'MiniMax 任务', note: '查询中', startedAt: props.block?.time })
      }
      if (task.kind === 'video') {
        return e(VideoCard, { ...props, block: { ...(props.block || {}), meta: { ...(props.block?.meta || {}), task } } })
      }
      if (task.kind === 'image') {
        return e(ImageCard, { ...props, block: { ...(props.block || {}), meta: { ...(props.block?.meta || {}), task } } })
      }
      return e(
        CardFrame,
        { title: 'MiniMax 任务' },
        e('div', { className: 'h3-card-line' }, `${task.id} · ${task.status}`),
        task.error ? e('div', { className: 'h3-card-warn' }, task.error.message) : null,
      )
    }

    function ListCard(props) {
      const meta = props.phase === 'result' ? props.block?.meta : null
      const tasks = meta?.tasks || []
      return e(
        CardFrame,
        { title: `MiniMax 任务 · ${tasks.length}` },
        tasks.length
          ? tasks.map((task) =>
              e(
                'div',
                { key: task.id, className: 'h3-listrow' },
                e('span', { className: 'h3-listkind' }, task.kind),
                e('span', { className: 'h3-listid' }, task.id),
                e('span', { className: 'h3-liststatus' }, task.status),
                e('span', { className: 'h3-listcost' }, money(task.cost)),
              ),
            )
          : e('div', { className: 'h3-card-line' }, t('noTasks')),
      )
    }

    function ErrorCard({ title, text, action, secondary, notice }) {
      return e(
        CardFrame,
        { title, tone: 'warn' },
        e('div', { className: 'h3-card-line' }, text || ''),
        action || secondary ? e('div', { className: 'h3-actions' }, secondary, action) : null,
        notice ? e('div', { className: 'h3-msg' }, notice) : null,
      )
    }

    // ----------------------------------------------------- right sidebar

    const TASK_STATUS = {
      succeeded: '成功',
      partial: '部分成功',
      saved: '已保存',
      generating: '生成中',
      queued: '排队中',
      polling: '轮询中',
      downloading: '下载中',
      'download-failed': '下载失败',
      failed: '失败',
      'submission-unknown': '提交未知',
    }

    function MiniMaxLogo(props) {
      const size = Number(props?.size) > 0 ? Number(props.size) : 20
      return e(
        'svg',
        {
          viewBox: '0 0 256 214',
          width: size,
          height: Math.round((size * 214) / 256),
          className: props?.className,
          'aria-hidden': 'true',
        },
        e(
          'defs',
          null,
          e(
            'linearGradient',
            { id: 'h3-minimax-logo-gradient', x1: '0%', x2: '100%', y1: '50%', y2: '50%' },
            e('stop', { offset: '0%', stopColor: '#e2167e' }),
            e('stop', { offset: '100%', stopColor: '#fe603c' }),
          ),
        ),
        e('path', {
          fill: 'url(#h3-minimax-logo-gradient)',
          d: 'M173.632 0c12.33 0 22.325 9.888 22.325 22.08v133.344a7.893 7.893 0 0 0 7.936 7.562a7.893 7.893 0 0 0 7.926-7.562V75.722a21.973 21.973 0 0 1 22.09-21.855A21.973 21.973 0 0 1 256 75.733v69.984a6.923 6.923 0 0 1-6.955 6.88a6.923 6.923 0 0 1-6.965-6.88V75.733a8.13 8.13 0 0 0-8.17-8.085a8.13 8.13 0 0 0-8.171 8.085v79.701a21.73 21.73 0 0 1-21.846 21.61a21.73 21.73 0 0 1-21.845-21.61V22.101a8.373 8.373 0 0 0-8.405-8.032a8.373 8.373 0 0 0-8.416 8.022l-.011 169.642c-.07 11.996-9.85 21.665-21.845 21.6a21.73 21.73 0 0 1-21.846-21.61v-20.63c0-3.798 3.115-6.88 6.955-6.88s6.955 3.082 6.955 6.88v20.63c0 2.804 1.514 5.396 3.968 6.804a8.04 8.04 0 0 0 7.936 0a7.83 7.83 0 0 0 3.968-6.805V22.08C151.307 9.888 161.3 0 173.632 0m-60.523 0c12.331 0 22.326 9.888 22.326 22.08v122.912a6.91 6.91 0 0 1-6.955 6.88a6.91 6.91 0 0 1-6.955-6.88V22.08a8.373 8.373 0 0 0-8.416-8.32a8.373 8.373 0 0 0-8.416 8.32v149.47c-.07 12.128-9.952 21.905-22.08 21.846c-12.131.065-22.02-9.714-22.09-21.846V75.733a8.13 8.13 0 0 0-8.171-8.085a8.13 8.13 0 0 0-8.17 8.085v40.533a21.973 21.973 0 0 1-22.091 21.856A21.973 21.973 0 0 1 0 116.266v-14.698c0-3.808 3.115-6.891 6.955-6.891s6.965 3.093 6.965 6.89v14.7c0 4.458 3.659 8.074 8.17 8.074c4.513 0 8.171-3.616 8.171-8.075V75.722c.07-12.127 9.953-21.904 22.08-21.845c12.132-.065 22.02 9.714 22.091 21.845v95.83c0 4.469 3.659 8.085 8.181 8.085c4.512 0 8.171-3.616 8.171-8.086V22.08C90.784 9.888 100.779 0 113.109 0',
        }),
      )
    }

    const TASK_STATUS_EN = {
      succeeded: 'Succeeded',
      partial: 'Partial',
      saved: 'Saved',
      generating: 'Generating',
      queued: 'Queued',
      polling: 'Polling',
      downloading: 'Downloading',
      'download-failed': 'Download failed',
      failed: 'Failed',
      'submission-unknown': 'Submission unknown',
    }

    function statusLabel(status) {
      const table = currentLanguage() === 'en' ? TASK_STATUS_EN : TASK_STATUS
      return table[status] || status || L('未知', 'Unknown')
    }

    function statusTone(status) {
      if (['saved', 'succeeded', 'partial'].includes(status)) return 'ok'
      if (['failed', 'submission-unknown', 'download-failed'].includes(status)) return 'bad'
      if (['generating', 'queued', 'polling', 'downloading'].includes(status)) return 'run'
      return ''
    }

    function formatDateTime(value) {
      if (!value) return ''
      const date = new Date(value)
      if (!Number.isFinite(date.getTime())) return ''
      const pad = (number) => String(number).padStart(2, '0')
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    }

    function TypeGlyph({ video }) {
      return e(
        'svg',
        { viewBox: '0 0 20 20', width: 20, height: 20, 'aria-hidden': 'true' },
        video
          ? e('path', { d: 'M7 5l8 5-8 5z', fill: 'currentColor' })
          : e(
              React.Fragment,
              null,
              e('rect', { x: 3, y: 4, width: 14, height: 12, rx: 2, fill: 'none', stroke: 'currentColor', strokeWidth: 1.4 }),
              e('circle', { cx: 7, cy: 8, r: 1.3, fill: 'currentColor' }),
              e('path', { d: 'M4.5 14l4-4 2.5 2.5 2-2 2.5 3.5', fill: 'none', stroke: 'currentColor', strokeWidth: 1.2, strokeLinejoin: 'round' }),
            ),
      )
    }

    function TypeCard({ kind, active, onClick }) {
      const video = kind === 'video'
      return e(
        'button',
        { type: 'button', className: `h3-typecard${active ? ' on' : ''}`, onClick },
        e('span', { className: 'h3-typeicon' }, e(TypeGlyph, { video })),
        e(
          'span',
          { className: 'h3-typetext' },
          e('b', null, video ? L('视频任务', 'Video task') : L('图片任务', 'Image task')),
          e('span', null, video ? L('文生 / 首尾帧 / 参考', 'Text / frames / reference') : L('文生图 / 图生图', 'Text to image / edit')),
        ),
      )
    }

    function FormCard({ title, hint, children }) {
      return e(
        'section',
        { className: 'h3-formcard' },
        e(
          'div',
          { className: 'h3-formcardhead' },
          e('b', null, title),
          hint ? e('span', null, hint) : null,
        ),
        e('div', { className: 'h3-formcardbody' }, children),
      )
    }

    function PromptExamples({ items, onPick, onRefresh }) {
      return e(
        'div',
        { className: 'h3-examples' },
        e('span', { className: 'h3-examplelab' }, L('试试', 'Try')),
        e(
          'div',
          { className: 'h3-examplelist' },
          items.map((item) =>
            e('button', { key: item, type: 'button', className: 'h3-example', onClick: () => onPick(item) }, item),
          ),
        ),
        onRefresh
          ? e(
              'button',
              { type: 'button', className: 'h3-example-refresh', onClick: onRefresh, title: L('换一批示例', 'New examples'), 'aria-label': L('换一批示例', 'New examples') },
              e(
                'svg',
                { viewBox: '0 0 20 20', width: 13, height: 13, 'aria-hidden': 'true' },
                e('path', {
                  d: 'M16 10a6 6 0 1 1-1.8-4.4M16 4v4h-4',
                  fill: 'none',
                  stroke: 'currentColor',
                  strokeWidth: 1.6,
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                }),
              ),
            )
          : null,
      )
    }

    function TabIcon({ id }) {
      const common = {
        viewBox: '0 0 20 20',
        width: 14,
        height: 14,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.6,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
      }
      if (id === 'new') return e('svg', common, e('path', { d: 'M10 4v12M4 10h12' }))
      if (id === 'tasks') {
        return e(
          'svg',
          common,
          e('circle', { cx: 10, cy: 10, r: 6.5 }),
          e('path', { d: 'M10 6.5V10l2.5 1.8' }),
        )
      }
      return e(
        'svg',
        { ...common, viewBox: '0 0 24 24', width: 14, height: 14, strokeWidth: 2 },
        e('path', {
          d: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z',
        }),
        e('circle', { cx: 12, cy: 12, r: 3 }),
      )
    }

    function NewTaskPanel({ sessionId, data, onCreated }) {
      const [kind, setKind] = useState('image')
      const [imageMode, setImageMode] = useState('text')
      const [imagePrompt, setImagePrompt] = useState('')
      const [videoPrompt, setVideoPrompt] = useState('')
      const [image, setImage] = useState({
        model: 'MiniMax-H3-Image',
        aspectRatio: '16:9',
        area: '1K',
        n: 1,
        format: 'jpeg',
        enhance: true,
        refs: [],
      })
      const [video, setVideo] = useState({
        model: 'MiniMax-H3',
        mode: 'text',
        resolution: '768P',
        duration: 5,
        ratio: '16:9',
        audio: true,
        firstFrame: '',
        lastFrame: '',
        referenceImages: [],
        referenceVideos: [],
        referenceAudios: [],
      })
      const [busy, setBusy] = useState(false)
      const [optimizing, setOptimizing] = useState(false)
      const [confirmVideo, setConfirmVideo] = useState(false)
      const [imageExample, setImageExample] = useState(0)
      const [videoExample, setVideoExample] = useState(0)
      const [notice, setNotice] = useState('')
      const initialized = useRef(false)

      useEffect(() => {
        if (initialized.current || !data?.settings) return
        const settings = data.settings
        setImage({
          model: settings.models.image,
          aspectRatio: settings.image.aspectRatio,
          area: settings.image.area,
          n: settings.image.n,
          format: settings.image.format,
          enhance: settings.image.enhance,
          refs: [],
        })
        setVideo({
          model: settings.models.video,
          mode: settings.video.mode || 'text',
          resolution: settings.video.resolution,
          duration: settings.video.duration,
          ratio: settings.video.ratio,
          audio: settings.video.audio,
          firstFrame: settings.video.firstFrame || '',
          lastFrame: settings.video.lastFrame || '',
          referenceImages: settings.video.referenceImages || [],
          referenceVideos: settings.video.referenceVideos || [],
          referenceAudios: settings.video.referenceAudios || [],
        })
        setVideoPrompt(settings.video.prompt || '')
        initialized.current = true
      }, [data])

      const imageResults = (data?.tasks || [])
        .filter((task) => task.kind === 'image' && task.files?.length)
        .flatMap((task) => task.files.map((file) => file.path))
      const videoResults = (data?.tasks || [])
        .filter((task) => task.kind === 'video' && task.files?.length)
        .flatMap((task) => task.files.map((file) => file.path))
      const image01 = image.model === 'image-01'
      const hailuo = video.model === 'MiniMax-Hailuo-2.3'
      const predicted = image01 ? null : imagePixels(image.area, image.aspectRatio)
      const videoPredicted = videoPixels(video.resolution, video.ratio)
      const imageCost = image.n * (data?.settings?.pricing?.imagePerCall ?? 0.3)
      const videoCost = video.duration * (data?.settings?.pricing?.videoPerSecond ?? 0.5)

      function patchImage(values) {
        setImage((current) => ({ ...current, ...values }))
      }
      function patchVideo(values) {
        setVideo((current) => ({ ...current, ...values }))
        if (confirmVideo) setConfirmVideo(false)
      }

      async function submitImage() {
        if (!imagePrompt.trim()) return setNotice(L('请先填写图片描述。', 'Please enter an image prompt.'))
        if (imageMode === 'edit' && !image.refs.length) return setNotice(L('图生图至少需要一张参考图。', 'Image edit needs at least one reference image.'))
        setBusy(true)
        setNotice('')
        try {
          const result = await apiPost('/generate', {
            kind: imageMode === 'edit' ? 'edit' : 'image',
            sessionId,
            prompt: imagePrompt,
            model: image.model,
            aspectRatio: image.aspectRatio,
            area: image.area,
            n: image.n,
            format: image.format,
            enhance: image.enhance,
            ...(imageMode === 'edit' ? { images: image.refs } : {}),
          })
          await hub.refresh(sessionId, true)
          setNotice(L(`已生成 ${result.task?.files?.length ?? 0} 张`, `Generated ${result.task?.files?.length ?? 0} image(s)`))
          onCreated?.()
        } catch (error) {
          setNotice(error.message)
        } finally {
          setBusy(false)
        }
      }

      async function optimizeVideo() {
        if (!videoPrompt.trim()) return setNotice(L('请先填写视频描述。', 'Please enter a video prompt.'))
        setOptimizing(true)
        setNotice('')
        try {
          const result = await apiPost('/action', {
            action: 'enhance',
            sessionId,
            prompt: videoPrompt,
            duration: video.duration,
            ratio: video.ratio === 'adaptive' ? '16:9' : video.ratio,
          })
          setVideoPrompt(result.task?.enhance?.prompt || videoPrompt)
          setNotice(L(`提示词已增强 · tokens ${result.task?.enhance?.tokens ?? 0}`, `Prompt enhanced · tokens ${result.task?.enhance?.tokens ?? 0}`))
        } catch (error) {
          setNotice(error.message)
        } finally {
          setOptimizing(false)
        }
      }

      async function submitVideo() {
        if (!videoPrompt.trim()) return setNotice(L('请先填写视频描述。', 'Please enter a video prompt.'))
        if (video.mode === 'frames' && !video.firstFrame) return setNotice(L('首尾帧模式必须给首帧。', 'First/last frame mode requires a first frame.'))
        if (video.mode === 'reference' && !video.referenceImages.length && !video.referenceVideos.length && !video.referenceAudios.length) {
          return setNotice(L('参考生视频至少需要一张参考图、一段参考视频或一段参考音频。', 'Reference mode needs at least one reference image, video, or audio.'))
        }
        setBusy(true)
        setNotice('')
        try {
          await apiPost('/generate', {
            kind: 'video',
            sessionId,
            mode: video.mode,
            prompt: videoPrompt,
            model: video.model,
            resolution: video.resolution,
            duration: video.duration,
            ratio: video.mode === 'frames' ? 'adaptive' : video.ratio,
            audio: video.audio,
            firstFrame: video.firstFrame,
            lastFrame: video.lastFrame,
            referenceImages: video.referenceImages,
            referenceVideos: video.referenceVideos,
            referenceAudios: video.referenceAudios,
          })
          await hub.refresh(sessionId, true)
          setNotice(L('视频任务已提交', 'Video task submitted'))
          onCreated?.()
        } catch (error) {
          setNotice(error.message)
        } finally {
          setBusy(false)
        }
      }

      return e(
        'div',
        { className: 'h3 h3-settings h3-newform' },
        e(
          'div',
          { className: 'h3-newform-scroll' },
          e(
            'div',
            { className: 'h3-typecards' },
            e(TypeCard, {
              kind: 'image',
              active: kind === 'image',
              onClick: () => {
                setKind('image')
                setConfirmVideo(false)
              },
            }),
            e(TypeCard, {
              kind: 'video',
              active: kind === 'video',
              onClick: () => {
                setKind('video')
                setConfirmVideo(false)
              },
            }),
          ),
          kind === 'image'
            ? e(
                React.Fragment,
                null,
                e(
                  FormCard,
                  { title: L('画面', 'Prompt'), hint: L('主体、光线、风格', 'Subject, light, style') },
                  e(ImageModes, { mode: imageMode, onChange: setImageMode }),
                  e('div', { className: 'h3-note' }, L(`当前模型：${image.model}（在 设置 → 模型 修改）`, `Current model: ${image.model} (change in Settings → Models)`)),
                  e('div', { className: 'h3-promptrow' }, e(TextBox, { area: true, rows: 3, value: imagePrompt, onChange: setImagePrompt, placeholder: L('描述画面；镜头、光线、材质都可以写', 'Describe the scene, lighting, and material') })),
                  e(PromptExamples, {
                    items: (currentLanguage() === 'en' ? IMAGE_EXAMPLE_SETS_EN : IMAGE_EXAMPLE_SETS)[imageExample % IMAGE_EXAMPLE_SETS.length],
                    onPick: setImagePrompt,
                    onRefresh: () => setImageExample((value) => value + 1),
                  }),
                ),
                e(
                  FormCard,
                  { title: L('参数', 'Parameters'), hint: L('比例与输出规格', 'Aspect ratio and output') },
                  e(Field, { label: t('ratio') }, e(RatioChips, { value: image.aspectRatio, onChange: (value) => patchImage({ aspectRatio: value }) })),
                  e('div', { className: 'h3-newdivider' }),
                  e(
                    'div',
                    { className: 'h3-row h3-row-center' },
                    e('span', { className: 'h3-lab' }, t('resolution')),
                    e(
                      'div',
                      { className: 'h3-ctl h3-inline' },
                      e(Seg, {
                        value: image.area,
                        options: [
                          { value: '1K', label: '1K' },
                          { value: '2K', label: '2K' },
                          { value: '4K', label: '4K' },
                        ],
                        onChange: (value) => !image01 && patchImage({ area: value }),
                      }),
                      e('span', { className: 'h3-inline-lab' }, t('count')),
                      e(SelectBox, {
                        value: String(image.n),
                        width: 56,
                        options: Array.from({ length: image01 ? 9 : 10 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) })),
                        onChange: (value) => patchImage({ n: Number(value) }),
                      }),
                      e('span', { className: 'h3-inline-lab' }, t('format')),
                      e(SelectBox, {
                        value: image.format,
                        width: 70,
                        options: ['jpeg', 'png', 'webp'].map((value) => ({ value, label: value })),
                        onChange: (value) => patchImage({ format: value }),
                      }),
                      e('span', { className: 'h3-inline-lab' }, t('enhance')),
                      e(Toggle, { checked: Boolean(image.enhance), onChange: (value) => patchImage({ enhance: value }) }),
                    ),
                  ),
                  e(
                    'div',
                    { className: 'h3-note' },
                    image01 ? L('image-01 无面积档；比例固定 8 档。', 'image-01 has no area tier; 8 fixed ratios.') : L(`预计 ${predicted ? `${predicted.width}×${predicted.height}` : '—'}（实际以返回 size 为准）`, `Predicted ${predicted ? `${predicted.width}×${predicted.height}` : '—'} (actual size from response)`),
                  ),
                ),
                imageMode === 'edit'
                  ? e(
                      FormCard,
                      { title: L('图生图', 'Image edit'), hint: t('refsHint') },
                      e(RefSlots, {
                        refs: image.refs,
                        max: 16,
                        kind: 'image',
                        labelled: true,
                        hint: L('请上传文件（JPG / PNG / WebP / HEIC 等）', 'Please upload a file (JPG / PNG / WebP / HEIC, etc.)'),
                        onChange: (value) => patchImage({ refs: value }),
                        lastResults: imageResults,
                      }),
                    )
                  : null,
              )
            : e(
                React.Fragment,
                null,
                e(
                  FormCard,
                  { title: L('画面', 'Prompt'), hint: L('镜头、动作与声音', 'Camera, action, sound') },
                  e(VideoModes, {
                    mode: video.mode,
                    onChange: (value) =>
                      patchVideo({ mode: value, ...(value === 'text' && video.ratio === 'adaptive' ? { ratio: '16:9' } : {}) }),
                  }),
                  e('div', { className: 'h3-note' }, L(`当前模型：${video.model}（在 设置 → 模型 修改）`, `Current model: ${video.model} (change in Settings → Models)`)),
                  e('div', { className: 'h3-promptrow' }, e(TextBox, { area: true, rows: 3, value: videoPrompt, onChange: setVideoPrompt, placeholder: t('promptPlaceholder') })),
                  e(PromptExamples, {
                    items: (currentLanguage() === 'en' ? VIDEO_EXAMPLE_SETS_EN : VIDEO_EXAMPLE_SETS)[videoExample % VIDEO_EXAMPLE_SETS.length],
                    onPick: setVideoPrompt,
                    onRefresh: () => setVideoExample((value) => value + 1),
                  }),
                  e(
                    'div',
                    { className: 'h3-optline' },
                    e(Btn, { primary: true, onClick: optimizeVideo, disabled: optimizing }, optimizing ? '优化中…' : t('optimize')),
                    e('span', { className: 'h3-hint' }, L('H3-Context-IR：只返回提示词，不出片；按 tokens 计费', 'H3-Context-IR returns a prompt only; billed by tokens')),
                  ),
                ),
                video.mode === 'frames'
                  ? e(
                      FormCard,
                      { title: L('首尾帧', 'First / last frame'), hint: L('首帧必填，尾帧可选', 'First frame required, last optional') },
                      e(
                        'div',
                        { className: 'h3-frame-row' },
                        e(FrameSlot, {
                          label: t('firstFrame'),
                          value: video.firstFrame,
                          onChange: (value) => patchVideo({ firstFrame: value }),
                        }),
                        e(FrameSlot, {
                          label: `${t('lastFrame')} · ${t('optional')}`,
                          value: video.lastFrame,
                          onChange: (value) => patchVideo({ lastFrame: value }),
                        }),
                        e('span', { className: 'h3-frame-hint' }, L('请上传文件（JPG / PNG / WebP / HEIC 等）', 'Please upload a file (JPG / PNG / WebP / HEIC, etc.)')),
                      ),
                    )
                  : video.mode === 'reference'
                    ? e(
                        FormCard,
                        { title: L('参考素材', 'References'), hint: L('图 ≤9 · 视频 ≤3 · 音频 ≤3', 'Images ≤9 · videos ≤3 · audio ≤3') },
                        e(
                          'div',
                          { className: 'h3-refgroups' },
                          e(
                            'div',
                            { className: 'h3-refgroup' },
                            e('span', { className: 'h3-lab' }, `${t('refImages')} ≤9`),
                            e(
                              'div',
                              { className: 'h3-ref-body' },
                              e(RefSlots, { refs: video.referenceImages, max: 9, kind: 'image', onChange: (value) => patchVideo({ referenceImages: value }), lastResults: imageResults }),
                              e('span', { className: 'h3-ref-hint' }, L('请上传图片（JPG / PNG / WebP / HEIC 等）', 'Upload an image (JPG / PNG / WebP / HEIC, etc.)')),
                            ),
                          ),
                          e(
                            'div',
                            { className: 'h3-refgroup' },
                            e('span', { className: 'h3-lab' }, `${t('refVideos')} ≤3`),
                            e(
                              'div',
                              { className: 'h3-ref-body' },
                              e(RefSlots, { refs: video.referenceVideos, max: 3, kind: 'video', onChange: (value) => patchVideo({ referenceVideos: value }), lastResults: videoResults }),
                              e('span', { className: 'h3-ref-hint' }, L('请上传视频（MP4 / MOV 等）', 'Upload a video (MP4 / MOV, etc.)')),
                            ),
                          ),
                          e(
                            'div',
                            { className: 'h3-refgroup' },
                            e('span', { className: 'h3-lab' }, `${t('refAudios')} ≤3`),
                            e(
                              'div',
                              { className: 'h3-ref-body' },
                              e(RefSlots, { refs: video.referenceAudios, max: 3, kind: 'audio', onChange: (value) => patchVideo({ referenceAudios: value }), lastResults: [] }),
                              e('span', { className: 'h3-ref-hint' }, L('请上传音频（MP3 / WAV 等）', 'Upload audio (MP3 / WAV, etc.)')),
                            ),
                          ),
                        ),
                      )
                    : null,
                e(
                  FormCard,
                  { title: L('参数', 'Parameters'), hint: L('比例、分辨率与时长', 'Ratio, resolution, duration') },
                  e(Field, {
                    label: t('ratio'),
                  }, e(RatioChips, {
                    value: video.mode === 'frames' ? 'adaptive' : video.ratio,
                    disabled: video.mode === 'frames',
                    extraAdaptive: video.mode === 'reference',
                    onChange: (value) => patchVideo({ ratio: value }),
                  })),
                  e('div', { className: 'h3-newdivider' }),
                  e(
                    'div',
                    { className: 'h3-row h3-row-center' },
                    e('span', { className: 'h3-lab' }, t('resolution')),
                    e(
                      'div',
                      { className: 'h3-ctl h3-inline' },
                      e(Seg, {
                        value: video.resolution,
                        options: (hailuo ? ['768P', '1080P'] : ['480P', '768P', '2K']).map((value) => ({ value, label: value })),
                        onChange: (value) => patchVideo({ resolution: value }),
                      }),
                      e('span', { className: 'h3-inline-lab' }, t('duration')),
                      e(SelectBox, {
                        value: String(video.duration),
                        width: 72,
                        options: (hailuo
                          ? [6, 10]
                          : video.model === 'MiniMax-H3-Max'
                            ? Array.from({ length: 11 }, (_, index) => index + 5)
                            : Array.from({ length: 12 }, (_, index) => index + 4)
                        ).map((value) => ({ value: String(value), label: L(`${value} 秒`, `${value}s`) })),
                        onChange: (value) => patchVideo({ duration: Number(value) }),
                      }),
                      e('span', { className: 'h3-inline-lab' }, L('音频', 'Audio')),
                      e(Toggle, { checked: Boolean(video.audio), onChange: (value) => patchVideo({ audio: value }) }),
                      e('span', { className: 'h3-hint' }, videoPredicted && video.ratio !== 'adaptive' ? L(`实际约 ${videoPredicted.width}×${videoPredicted.height}`, `Approx. ${videoPredicted.width}×${videoPredicted.height}`) : L('比例自适应', 'Adaptive ratio')),
                    ),
                  ),
                ),
              ),
        ),
        e(
          'div',
          { className: 'h3-submitbar' },
          e(
            'div',
            { className: 'h3-submitinfo' },
            e('b', null, kind === 'image' ? L(`约 ¥${imageCost.toFixed(2)}`, `Approx. ¥${imageCost.toFixed(2)}`) : L(`约 ¥${videoCost.toFixed(2)}`, `Approx. ¥${videoCost.toFixed(2)}`)),
            e('span', null, kind === 'image' ? L(`${image.n} 张 · 同步生成，最长 600 秒`, `${image.n} image(s) · synchronous, up to 600 s`) : L(`${video.duration} 秒 · 异步生成，可在历史取回`, `${video.duration}s · asynchronous, fetch in History`)),
            notice ? e('span', { className: 'h3-submitmsg', role: 'status' }, notice) : null,
          ),
          e(
            Btn,
            {
              primary: true,
              disabled: busy || optimizing,
              onClick: kind === 'image'
                ? submitImage
                : confirmVideo
                  ? () => {
                      setConfirmVideo(false)
                      submitVideo()
                    }
                  : () => {
                      setConfirmVideo(true)
                      setNotice(L(`预计 ¥${videoCost.toFixed(2)}，再点一次确认提交。`, `Estimated ¥${videoCost.toFixed(2)}; click again to confirm.`))
                    },
            },
            busy
              ? kind === 'image'
                ? L('生成中…', 'Generating…')
                : L('提交中…', 'Submitting…')
              : kind === 'image'
                ? L('生成图片', 'Generate image')
                : confirmVideo
                  ? L(`确认生成 · ¥${videoCost.toFixed(2)}`, `Confirm · ¥${videoCost.toFixed(2)}`)
                  : L('生成视频', 'Generate video'),
          ),
        ),
      )

    }

    function MiniMaxTab(props) {
      const sessionId = String(props.sessionId || 'global')
      const data = useHubData(sessionId)
      const langSetting = data?.settings?.ui?.language
      if (langSetting === 'en' || langSetting === 'zh') uiLanguage = langSetting
      const [section, setSection] = useState('new')
      const balance = data?.balance
      const tabs = [
        ['new', L('新建', 'New')],
        ['tasks', L('历史', 'History')],
        ['settings', L('设置', 'Settings')],
      ]
      return e(
        'div',
        { className: 'h3 h3-tab' },
        e(StyleTag),
        e(
          'div',
          { className: 'h3-tabhead' },
          e(
            'button',
            {
              type: 'button',
              className: `h3-tabpill${balance?.alert?.triggered ? ' warn' : ''}`,
              onClick: () => setSection('settings'),
              title: L('MiniMax 余额与预警', 'MiniMax balance and alerts'),
              'aria-label': L('打开 MiniMax 设置', 'Open MiniMax settings'),
            },
            e('span', { className: `h3-dot${balance?.alert?.triggered ? ' warn' : ''}` }),
            e('span', { className: 'h3-tab-brand' }, 'MiniMax'),
            balance
              ? e(
                  'span',
                  { className: 'h3-tabbalance-text' },
                  e('span', { className: 'h3-tabbalance-label' }, `${t('dockBalance')} `),
                  e('b', null, money(balance.current)),
                  e('span', { className: 'h3-tabbalance-sep' }, ` · ${t('dockSession')} `),
                  e('b', null, money(balance.sessionSpend)),
                  balance.alert?.triggered
                    ? e('span', { className: 'h3-tabbalance-sep' }, ` · ${L('低于', 'below')} ${money(balance.alert.threshold)}`)
                    : null,
                )
              : e('span', { className: 'h3-tabbalance-text' }, L('余额 —', 'Balance —')),
          ),
          e(
            'button',
            { type: 'button', className: 'h3-tabrefresh', onClick: () => hub.refresh(sessionId, true), title: L('刷新', 'Refresh'), 'aria-label': L('刷新', 'Refresh') },
            e(
              'svg',
              { viewBox: '0 0 20 20', width: 15, height: 15, 'aria-hidden': 'true' },
              e('path', {
                d: 'M16 10a6 6 0 1 1-1.8-4.4M16 4v4h-4',
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: 1.6,
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
              }),
            ),
          ),
        ),
        e(
          'div',
          { className: 'h3-subtabs', role: 'tablist', 'aria-label': L('MiniMax 页面', 'MiniMax sections') },
          tabs.map(([id, label], index) =>
            e(
              'button',
              {
                key: id,
                type: 'button',
                role: 'tab',
                'aria-selected': section === id,
                tabIndex: section === id ? 0 : -1,
                className: `h3-subtab${section === id ? ' on' : ''}`,
                onClick: () => setSection(id),
                onKeyDown: (event) => {
                  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
                  event.preventDefault()
                  const nextIndex = event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? tabs.length - 1
                      : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
                  const next = tabs[nextIndex]
                  setSection(next[0])
                  const buttons = event.currentTarget.parentElement?.querySelectorAll('[role="tab"]')
                  buttons?.[nextIndex]?.focus()
                },
              },
              label,
              e(TabIcon, { id }),
            ),
          ),
        ),
        e(
          'div',
          { className: 'h3-tabbody', role: 'tabpanel', 'aria-label': tabs.find(([id]) => id === section)?.[1] || '' },
          section === 'new'
            ? e(NewTaskPanel, { sessionId, data, onCreated: () => setSection('tasks') })
            : section === 'settings'
              ? e(SettingsPage, { sessionId })
              : e(TaskPanel, { sessionId, data, onNew: () => setSection('new'), inputActions: props.inputActions }),
        ),
      )
    }

    function TaskPanel({ sessionId, data, onNew, inputActions }) {
      const [filter, setFilter] = useState('all')
      const [poll, setPoll] = useState({ lastAt: 0, error: '', checking: false })
      const error = useHubError(sessionId)
      const runningKey = data
        ? (data.tasks || [])
            .filter((task) => ['generating', 'queued', 'polling', 'downloading'].includes(task.status))
            .map((task) => task.id)
            .join('|')
        : ''
      const polling = useRef(false)
      useEffect(() => {
        if (!runningKey) return undefined
        const ids = runningKey.split('|')
        let cancelled = false
        async function tick() {
          if (cancelled || polling.current) return
          polling.current = true
          if (!cancelled) setPoll((previous) => ({ ...previous, checking: true }))
          const oldest = (data?.tasks || [])
            .filter((task) => ['generating', 'queued', 'polling', 'downloading'].includes(task.status))
            .reduce((value, task) => {
              const time = Date.parse(task.createdAt || '')
              return Number.isFinite(time) && (!value || time < value) ? time : value
            }, 0)
          if (oldest && Date.now() - oldest > 30 * 60 * 1000) {
            if (!cancelled) setPoll({ lastAt: Date.now(), error: L('自动检查已超过 30 分钟，请手动取回或删除', 'Auto-check stopped after 30 minutes; fetch or delete manually'), checking: false })
            polling.current = false
            return
          }
          try {
            const results = await Promise.allSettled(
              ids.map((taskId) => apiPost('/action', { sessionId, action: 'status', taskId })),
            )
            const failure = results.find((result) => result.status === 'rejected')
            if (!cancelled) {
              setPoll({
                lastAt: Date.now(),
                error: failure ? String(failure.reason?.message || failure.reason || '') : '',
                checking: false,
              })
            }
            if (!cancelled) await hub.refresh(sessionId, true)
          } catch (error) {
            if (!cancelled) setPoll({ lastAt: Date.now(), error: error.message || String(error), checking: false })
          } finally {
            polling.current = false
          }
        }
        tick()
        const timer = setInterval(tick, 7000)
        return () => {
          cancelled = true
          clearInterval(timer)
        }
      }, [sessionId, runningKey])
      if (!data) {
        if (error) {
          return e(
            'div',
            { className: 'h3 h3-settings h3-history' },
            e(
              'div',
              { className: 'h3-empty h3-historyempty' },
              e('b', null, L('加载失败', 'Load failed')),
              e('span', null, error),
              e(Btn, { primary: true, onClick: () => hub.refresh(sessionId, true) }, L('重试', 'Retry')),
            ),
          )
        }
        return e(
          'div',
          { className: 'h3 h3-settings h3-history' },
          [0, 1, 2].map((index) => e('div', { key: index, className: 'h3-skeleton' }, e('span'), e('span'))),
        )
      }
      const tasks = data.tasks || []
      const filtered = tasks.filter((task) => {
        if (filter === 'image') return task.kind === 'image'
        if (filter === 'video') return task.kind === 'video'
        if (filter === 'failed') return ['failed', 'submission-unknown', 'download-failed'].includes(task.status)
        return true
      })
      const filters = [
        ['all', L('全部', 'All'), tasks.length],
        ['image', L('图片', 'Images'), tasks.filter((task) => task.kind === 'image').length],
        ['video', L('视频', 'Videos'), tasks.filter((task) => task.kind === 'video').length],
        ['failed', L('失败', 'Failed'), tasks.filter((task) => ['failed', 'submission-unknown', 'download-failed'].includes(task.status)).length],
      ]
      const runningTasks = tasks.filter((task) => ['generating', 'queued', 'polling', 'downloading'].includes(task.status))
      const oldestRunning = runningTasks.reduce((oldest, task) => {
        const time = Date.parse(task.createdAt || '')
        return Number.isFinite(time) && (!oldest || time < oldest) ? time : oldest
      }, 0)
      const stalled = oldestRunning > 0 && Date.now() - oldestRunning > 15 * 60 * 1000
      const pollTime = poll.lastAt ? new Date(poll.lastAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—'
      return e(
        'div',
        { className: 'h3 h3-settings h3-history' },
        runningKey
          ? e(
              'div',
              { className: `h3-autopoll${poll.error ? ' bad' : ''}`, title: poll.error || '', role: 'status', 'aria-live': 'polite' },
              e('span', null, poll.checking
                ? L('正在自动检查…', 'Checking automatically…')
                : poll.error
                  ? L(`自动检查失败，7 秒后重试：${poll.error}`, `Auto-check failed; retrying in 7s: ${poll.error}`)
                  : L(`自动检查中 · 最近 ${pollTime}`, `Auto-checking · last ${pollTime}`)),
              stalled ? e('b', null, L('等待较久，可手动取回或删除', 'Waiting a while; fetch or delete manually')) : null,
            )
          : null,
        e(
          'div',
          { className: 'h3-filters', role: 'group', 'aria-label': L('筛选任务', 'Filter tasks') },
          filters.map(([id, label, count]) =>
            e(
              'button',
              {
                key: id,
                type: 'button',
                className: `h3-filter${filter === id ? ' on' : ''}`,
                'aria-pressed': filter === id,
                onClick: () => setFilter(id),
              },
              label,
              e('span', null, count),
            ),
          ),
        ),
        filtered.length
          ? e(
              'div',
              { className: 'h3-tasklist' },
              filtered.map((task) => e(TaskRow, { key: task.id, sessionId, task, inputActions })),
            )
          : e(
              'div',
              { className: 'h3-empty h3-historyempty' },
              e('b', null, tasks.length ? L('没有匹配的任务', 'No matching tasks') : L('还没有任务', 'No tasks yet')),
              e('span', null, tasks.length ? L('换一个筛选条件试试。', 'Try another filter.') : L('用「新建」直接生成，或在对话里调用 minimax_h3_image / minimax_h3_video。', 'Use New to generate directly, or call minimax_h3_image / minimax_h3_video in the chat.')),
              tasks.length ? null : e(Btn, { primary: true, onClick: onNew }, L('去新建', 'Create one')),
            ),
      )
    }

    function DeleteDialog({ task, running, deleteFiles, onToggle, onCancel, onConfirm, busy, error }) {
      const dialogRef = useRef(null)
      useEffect(() => {
        const dialog = dialogRef.current
        const previous = document.activeElement
        const focusables = () => Array.from(
          dialog?.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])') || [],
        )
        const initial = dialog?.querySelector('.h3-del-actions button') || focusables()[0]
        initial?.focus?.()
        const onKey = (event) => {
          if (event.key === 'Escape') {
            onCancel()
            return
          }
          if (event.key !== 'Tab') return
          const nodes = focusables()
          if (!nodes.length) return
          const first = nodes[0]
          const last = nodes[nodes.length - 1]
          if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) {
            event.preventDefault()
            last.focus()
          } else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) {
            event.preventDefault()
            first.focus()
          }
        }
        window.addEventListener('keydown', onKey)
        return () => {
          window.removeEventListener('keydown', onKey)
          if (previous?.isConnected) previous.focus?.()
        }
      }, [onCancel])
      const tree = e(
        'div',
        {
          className: 'h3-del-overlay',
          onMouseDown: (event) => {
            if (event.target === event.currentTarget) onCancel()
          },
        },
        e(
          'div',
          { ref: dialogRef, className: 'h3-del-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': L('确认删除任务', 'Confirm task deletion') },
          e('div', { className: 'h3-del-title' }, L('确认删除任务？', 'Delete this task?')),
          e('div', { className: 'h3-del-text' }, L(`即将删除 ${task.kind} 任务 ${task.id}`, `About to delete ${task.kind} task ${task.id}`)),
          running ? e('div', { className: 'h3-del-warn' }, L('任务仍在运行，删除后结果将无法取回。', 'This task is still running; deleting it makes the result unrecoverable.')) : null,
          e(
            'label',
            { className: 'h3-del-check' },
            e('input', {
              type: 'checkbox',
              checked: Boolean(deleteFiles),
              onChange: (event) => onToggle(event.target.checked),
            }),
            e('span', null, L('同时删除数据目录中的文件', 'Also delete files in the data directory')),
          ),
          e(
            'div',
            { className: 'h3-del-hint' },
            deleteFiles ? L('媒体文件会一并删除，无法恢复。', 'Media files will also be deleted permanently.') : L('只删除任务记录，媒体文件会保留在数据目录。', 'Only the task record is deleted; media files remain.'),
          ),
          error ? e('div', { className: 'h3-msg bad' }, error) : null,
          e(
            'div',
            { className: 'h3-del-actions' },
            e(Btn, { onClick: onCancel, disabled: busy }, L('取消', 'Cancel')),
            e(Btn, { danger: true, onClick: onConfirm, disabled: busy }, busy ? L('删除中…', 'Deleting…') : L('删除', 'Delete')),
          ),
        ),
      )
      return createPortal ? createPortal(tree, document.body) : tree
    }

    function TaskRow({ sessionId, task, inputActions }) {
      const [busy, setBusy] = useState('')
      const [notice, setNotice] = useState('')
      const [confirm, setConfirm] = useState(false)
      const [showDelete, setShowDelete] = useState(false)
      const [deleteFiles, setDeleteFiles] = useState(true)
      const [moreOpen, setMoreOpen] = useState(false)
      const [morePos, setMorePos] = useState({ top: 0, left: 0 })
      const moreRef = useRef(null)
      const menuRef = useRef(null)
      useEffect(() => {
        if (!moreOpen) return undefined
        const onPointerDown = (event) => {
          if (moreRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return
          setMoreOpen(false)
        }
        const onKeyDown = (event) => {
          if (event.key === 'Escape') setMoreOpen(false)
        }
        document.addEventListener('pointerdown', onPointerDown)
        window.addEventListener('keydown', onKeyDown)
        menuRef.current?.querySelector('[role="menu"] button')?.focus?.()
        return () => {
          document.removeEventListener('pointerdown', onPointerDown)
          window.removeEventListener('keydown', onKeyDown)
        }
      }, [moreOpen])
      const files = task.files || []
      const first = files[0]
      const failed = ['failed', 'submission-unknown', 'download-failed'].includes(task.status)
      const running = ['generating', 'queued', 'polling', 'downloading'].includes(task.status)
      const createdMs = Date.parse(task.createdAt || '')
      const waitedMinutes = Number.isFinite(createdMs) ? Math.max(0, Math.floor((Date.now() - createdMs) / 60000)) : 0
      const checkedMs = Date.parse(task.provider?.checkedAt || '')
      const checkedTime = Number.isFinite(checkedMs)
        ? new Date(checkedMs).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
        : ''
      async function call(action, extra = {}) {
        setBusy(action)
        setNotice('')
        try {
          await apiPost('/action', { sessionId, action, taskId: task.id, ...extra })
          await hub.refresh(sessionId, true)
          setNotice(L('已更新', 'Updated'))
        } catch (error) {
          setNotice(error.message)
        } finally {
          setBusy('')
        }
      }
      async function removeTask() {
        setBusy('delete')
        setNotice('')
        try {
          await apiPost('/action', { sessionId, action: 'delete', taskId: task.id, deleteFiles })
          await hub.refresh(sessionId, true)
          setNotice(L('已删除', 'Deleted'))
          setShowDelete(false)
        } catch (error) {
          setNotice(error.message)
        } finally {
          setBusy('')
        }
      }
      async function openFile(file) {
        try {
          await apiPost('/action', { sessionId, action: 'open', path: file.path })
        } catch (error) {
          setNotice(error.message)
        }
      }
      async function openFolder(file) {
        try {
          await apiPost('/action', { sessionId, action: 'open-folder', path: file.path })
        } catch (error) {
          setNotice(error.message)
        }
      }
      async function copyFile(file) {
        setNotice((await copyText(file.path)) ? L('已复制', 'Copied') : file.path)
      }
      async function copyPrompt(text) {
        setNotice((await copyText(text)) ? L('提示词已复制', 'Prompt copied') : L('复制失败', 'Copy failed'))
      }
      async function select(kind, file) {
        try {
          await apiPost('/action', { sessionId, action: 'select', kind, path: file.path })
          setNotice(kind === 'reference' ? L('已设为下一段参考图', 'Set as next reference image') : L('已设为下一段首帧', 'Set as next first frame'))
        } catch (error) {
          setNotice(error.message)
        }
      }
      function startEdit() {
        const template = L(
          `请基于这条 MiniMax ${task.kind} 结果（任务 ${task.id}）修改：`,
          `Please modify this MiniMax ${task.kind} result (task ${task.id}):`,
        )
        try {
          if (typeof inputActions?.setDraft !== 'function') {
            setNotice(L('无法写入会话框，请手动描述修改要求', 'Cannot write to the composer; describe the change manually.'))
            return
          }
          inputActions.setDraft(template)
          if (typeof inputActions?.focus === 'function') inputActions.focus()
          setNotice(L('已在会话框插入修改描述', 'Modify prompt inserted into the composer'))
        } catch (error) {
          setNotice(L(`插入会话框失败：${error.message}`, `Failed to insert into composer: ${error.message}`))
        }
      }
      const primaryActions = []
      const moreActions = []
      let moreMenu = null
      if (first) primaryActions.push(e(Btn, { key: 'open', onClick: () => openFile(first) }, L('打开', 'Open')))
      if (task.kind === 'video' && running) {
        primaryActions.push(e(Btn, { key: 'fetch', primary: true, disabled: Boolean(busy), onClick: () => call('status') }, busy ? '…' : L('取回结果', 'Fetch result')))
      }
      const params = task.params || {}
      const source = params.source || {}
      const retryableVideo = task.kind === 'video' && failed && !task.provider?.contentUrl && (
        params.mode === 'text'
        || (params.mode === 'frames' && Boolean(source.firstFrame))
        || (params.mode === 'reference' && (source.images?.length || source.videos?.length || source.audios?.length))
      )
      if (retryableVideo) {
        primaryActions.push(
          confirm
            ? e(Btn, {
                key: 'confirm-video-retry',
                warn: true,
                disabled: Boolean(busy),
                onClick: () => {
                  setConfirm(false)
                  call('regenerate')
                },
              }, busy ? '…' : L('确认重试', 'Confirm retry'))
            : e(Btn, {
                key: 'video-retry',
                warn: true,
                onClick: () => setConfirm(true),
              }, L('重试', 'Retry')),
        )
      }
      if (task.kind === 'video' && failed && task.provider?.contentUrl) {
        primaryActions.push(e(Btn, { key: 'download', warn: true, disabled: Boolean(busy), onClick: () => call('download') }, busy ? '…' : L('重试下载', 'Retry download')))
      }
      if (task.kind === 'image' && failed) {
        primaryActions.push(
          confirm
            ? e(Btn, { key: 'confirm', warn: true, disabled: Boolean(busy), onClick: () => { setConfirm(false); call('regenerate') } }, busy ? '…' : L('确认重新生成', 'Confirm regenerate'))
            : e(Btn, { key: 'retry', warn: true, onClick: () => setConfirm(true) }, L('重试生成', 'Retry generate')),
        )
      }
      if (files.length) primaryActions.push(e(Btn, { key: 'edit-target', onClick: startEdit }, L('修改', 'Modify')))

      if (first && !failed) {
        moreActions.push(e(Btn, { key: 'folder', onClick: () => openFolder(first) }, L('打开所在文件夹', 'Open containing folder')))
        moreActions.push(e(Btn, { key: 'copy', onClick: () => copyFile(first) }, L('复制路径', 'Copy path')))
      }
      if (task.kind === 'image' && !failed) {
        if (first) {
          moreActions.push(e(Btn, { key: 'first', onClick: () => select('firstFrame', first) }, L('作为首帧', 'Use as first frame')))
          moreActions.push(e(Btn, { key: 'ref', onClick: () => select('reference', first) }, L('作为参考', 'Use as reference')))
        }
        moreActions.push(e(Btn, { key: 'regen', disabled: Boolean(busy), onClick: () => call('regenerate') }, busy ? '…' : L('重新生成', 'Regenerate')))
      }
      if (task.kind === 'enhance' && task.enhance?.prompt) {
        moreActions.push(e(Btn, { key: 'prompt', onClick: () => copyPrompt(task.enhance.prompt) }, L('复制提示词', 'Copy prompt')))
      }
      const deleteAction = e(
        Btn,
        {
          key: 'delete',
          danger: true,
          onClick: () => {
            setNotice('')
            setShowDelete(true)
          },
        },
        L('删除', 'Delete'),
      )
      if (failed) primaryActions.push(deleteAction)
      else moreActions.push(deleteAction)
      if (moreActions.length) {
        const toggleMore = () => {
          if (moreOpen) {
            setMoreOpen(false)
            return
          }
          const rect = moreRef.current?.querySelector('button')?.getBoundingClientRect?.()
          const width = 170
          const height = Math.min(280, moreActions.length * 34 + 16)
          const viewportWidth = Number(window.innerWidth) || 1024
          const viewportHeight = Number(window.innerHeight) || 768
          let left = rect?.left ?? 16
          let top = (rect?.bottom ?? 16) + 4
          if (left + width > viewportWidth - 8) left = Math.max(8, viewportWidth - width - 8)
          if (top + height > viewportHeight - 8) top = Math.max(8, (rect?.top ?? 16) - height - 4)
          setMorePos({ top, left })
          setMoreOpen(true)
        }
        moreMenu = moreOpen
          ? e(
              'div',
              {
                ref: menuRef,
                className: 'h3-menu h3-menu-fixed',
                style: { top: morePos.top, left: morePos.left },
                role: 'menu',
                'aria-label': L('任务操作', 'Task actions'),
                onClick: () => setMoreOpen(false),
                onKeyDown: (event) => {
                  if (event.key === 'Escape') { setMoreOpen(false); return }
                  if (menuArrow(event)) event.preventDefault()
                },
              },
              moreActions.map((action, index) =>
                e(
                  action.type,
                  { ...action.props, key: index, role: 'menuitem', tabIndex: -1 },
                  action.props?.children ?? action.children,
                ),
              ),
            )
          : null
        primaryActions.push(
          e(
            'div',
            { key: 'more', className: 'h3-morewrap', ref: moreRef },
            e(Btn, { onClick: toggleMore, 'aria-haspopup': 'menu', 'aria-expanded': moreOpen }, moreOpen ? L('收起', 'Close') : L('更多', 'More')),
          ),
        )
      }
      const createdAt = task.createdAt || task.created_at
      const timeText = formatDateTime(createdAt)
      return e(
        React.Fragment,
        null,
        e(
          'div',
          { className: `h3-task${failed ? ' warn' : ''}` },
          e(
            'div',
            { className: 'h3-taskhead' },
            e('span', { className: 'h3-taskkind' }, task.kind),
            e('span', { className: 'h3-taskmodel' }, task.model),
            e('span', { className: `h3-status ${statusTone(task.status)}` }, statusLabel(task.status)),
            timeText ? e('span', { className: 'h3-tasktime', title: createdAt }, timeText) : null,
            e('span', { className: 'h3-taskcost' }, money(task.cost)),
          ),
          running
            ? e(
                'div',
                { className: 'h3-progress' },
                e('i', { style: typeof task.progress === 'number' ? { width: `${Math.max(4, Math.min(100, task.progress))}%` } : undefined }),
              )
            : null,
          running
            ? e(
                'div',
                { className: 'h3-runmeta' },
                e('span', null, waitedMinutes < 1
                  ? L('已等待不到 1 分钟', 'Waiting under 1 min')
                  : L(`已等待 ${waitedMinutes} 分钟`, `Waiting ${waitedMinutes} min`)),
                checkedTime ? e('span', null, L(`最近查询 ${checkedTime}`, `Last checked ${checkedTime}`)) : null,
              )
            : null,
          e(TaskMedia, { task, onOpen: openFile }),
          e('div', { className: 'h3-taskprompt', title: task.prompt || '' }, (task.prompt || '').slice(0, 220)),
          task.error
            ? e('div', { className: 'h3-card-warn' }, `${task.error.message}${task.error.hint ? ` — ${task.error.hint}` : ''}`)
            : null,
          task.failures?.length
            ? e('div', { className: 'h3-card-warn' }, L(`部分失败：${task.failures.map((item) => `#${item.index + 1} ${item.code}`).join(' ')}`, `Partially failed: ${task.failures.map((item) => `#${item.index + 1} ${item.code}`).join(' ')}`))
            : null,
          task.kind === 'enhance' && task.enhance?.prompt
            ? e('div', { className: 'h3-taskprompt' }, task.enhance.prompt.slice(0, 240))
            : null,
          primaryActions.length ? e('div', { className: 'h3-actions' }, primaryActions) : null,
          notice ? e('div', { className: 'h3-msg' }, notice) : null,
        ),
        showDelete
          ? e(DeleteDialog, {
              task,
              running,
              deleteFiles,
              onToggle: setDeleteFiles,
              onCancel: () => setShowDelete(false),
              onConfirm: removeTask,
              busy: busy === 'delete',
              error: notice,
            })
          : null,
        moreMenu ? (createPortal ? createPortal(moreMenu, document.body) : moreMenu) : null,
      )
    }

    function TaskMedia({ task, onOpen }) {
      const files = task.files || []
      if (!files.length) return null
      return e(
        'div',
        { className: 'h3-taskmedia' },
        files.map((file) =>
          file.format === 'mp4'
            ? e(
                'button',
                { key: file.name, type: 'button', className: 'h3-taskvideo', onClick: () => onOpen(file), title: file.path },
                e('span', { className: 'h3-play' }),
                e('span', { className: 'h3-taskvideo-cap' }, `${task.params?.duration || ''}s ${task.params?.resolution || ''}`),
              )
            : e(
                'a',
                { key: file.name, className: 'h3-taskthumb', href: file.url, target: '_blank', rel: 'noreferrer', title: file.path },
                e('img', { src: file.url, alt: file.name, loading: 'lazy' }),
              ),
        ),
      )
    }

    function BalancePanel({ sessionId, data }) {
      const balance = data?.balance
      const [current, setCurrent] = useState('')
      const [threshold, setThreshold] = useState('')
      const [enabled, setEnabled] = useState(false)
      const [busy, setBusy] = useState(false)
      const [notice, setNotice] = useState('')
      useEffect(() => {
        if (!balance) return
        setCurrent(String(balance.current ?? ''))
        setThreshold(String(balance.alert?.threshold ?? 5))
        setEnabled(Boolean(balance.alert?.enabled))
      }, [balance?.current, balance?.alert?.enabled, balance?.alert?.threshold])
      async function save() {
        setBusy(true)
        setNotice('')
        try {
          await apiPost('/balance', {
            sessionId,
            current: Number(current),
            enabled,
            threshold: Number(threshold),
          })
          await hub.refresh(sessionId, true)
          setNotice(t('saved'))
        } catch (error) {
          setNotice(error.message)
        } finally {
          setBusy(false)
        }
      }
      return e(
        'div',
        { className: 'h3-balancepanel' },
        e('div', { className: 'h3-big' }, money(balance?.current ?? 0)),
        e(
          'div',
          { className: 'h3-note' },
          `${t('dockSession')} ${money(balance?.sessionSpend ?? 0)} · ${balance?.source === 'admin-key' ? 'admin key' : L('本地记账', 'local ledger')}`,
        ),
        balance?.alert?.triggered ? e('div', { className: 'h3-msg bad' }, L('余额低于预警线', 'Balance is below the alert line')) : null,
        e(
          'div',
          { className: 'h3-row' },
          e('span', { className: 'h3-lab' }, t('currentBalance')),
          e(NumberBox, { value: current, onChange: setCurrent, step: '0.01', width: 120 }),
        ),
        e(
          'div',
          { className: 'h3-row' },
          e('span', { className: 'h3-lab' }, t('bell')),
          e(Toggle, { checked: enabled, onChange: setEnabled }),
          e('span', { className: 'h3-inline-lab' }, t('threshold')),
          e(NumberBox, { value: threshold, onChange: setThreshold, step: '0.01', width: 100 }),
        ),
        e(
          'div',
          { className: 'h3-actions' },
          e(Btn, { primary: true, onClick: save, disabled: busy }, busy ? t('saving') : t('saveBalance')),
          e(Btn, { onClick: () => hub.refresh(sessionId, true) }, t('refresh')),
        ),
        notice ? e('div', { className: 'h3-msg' }, notice) : null,
        e('div', { className: 'h3-divider' }),
        e('div', { className: 'h3-h' }, L('按模型明细', 'By model')),
        (balance?.byModel || []).length
          ? balance.byModel.map((row) =>
              e(
                'div',
                { key: row.model, className: 'h3-balance-row' },
                e('span', null, row.model),
                e('span', { className: 'h3-hint' }, L(`${row.count} 次 · ${row.seconds ? `${row.seconds}s` : `${row.images} 张`}`, `${row.count} jobs · ${row.seconds ? `${row.seconds}s` : `${row.images} image(s)`}`)),
                e('span', { className: 'h3-balance-cost' }, money(row.cost)),
              ),
            )
          : e('div', { className: 'h3-note' }, L('暂无消耗', 'No usage yet')),
        e('div', { className: 'h3-note' }, t('estimatedNote')),
        balance?.liveError
          ? e('div', { className: 'h3-msg bad' }, `${balance.liveError.message}${balance.liveError.hint ? ` — ${balance.liveError.hint}` : ''}`)
          : null,
      )
    }

    function ToolLauncher(props) {
      const meta = props.phase === 'result' ? props.block?.meta : null
      const task = meta?.task || null
      const isError = props.phase === 'result' && props.block?.isError
      const args = parseArgs(props)
      let title = 'MiniMax'
      let line = ''
      if (isError) {
        title = L('MiniMax · 失败', 'MiniMax · Failed')
        line = errorText(props.block)
      } else if (meta?.kind === 'list') {
        line = L(`${(meta.tasks || []).length} 条任务`, `${(meta.tasks || []).length} task(s)`)
      } else if (!task) {
        line = args.prompt ? String(args.prompt).slice(0, 120) : L('任务已提交，打开右侧面板查看进度与结果。', 'Task submitted; open the right panel for progress and results.')
      } else {
        title = `MiniMax · ${task.kind}`
        line = `${statusLabel(task.status)} · ${money(task.cost)}${task.files?.length ? L(` · ${task.files.length} 个文件`, ` · ${task.files.length} file(s)`) : ''}`
      }
      return e(
        CardFrame,
        { title, tone: isError ? 'warn' : '' },
        e('div', { className: 'h3-card-line' }, line),
        e(
          'div',
          { className: 'h3-actions' },
          e(Btn, { primary: true, onClick: openMiniMaxTab }, L('打开 MiniMax', 'Open MiniMax')),
        ),
      )
    }

    // -------------------------------------------------------------- style

    function StyleTag() {
      return e('style', { dangerouslySetInnerHTML: { __html: CSS } })
    }

    const CSS = `
:root { --h3-fs-2xs: 10px; --h3-fs-xs: 11px; --h3-fs-sm: 12px; --h3-fs-md: 13px; --h3-fs-lg: 14px; --h3-fs-xl: 16px; --h3-fs-2xl: 18px; --h3-fs-3xl: 22px; --h3-fs-4xl: 24px; }
.h3 { color: var(--dsw-alias-label-primary); color: color-mix(in srgb, var(--dsw-alias-label-primary) 85%, var(--dsw-alias-bg-base)); font-size: var(--h3-fs-xs); line-height: 1.5; }
.h3 button { font-family: inherit; }
.h3-settings { padding: 2px 2px 24px; max-width: 760px; }
.h3-title { font-size: var(--h3-fs-lg); font-weight: 700; }
.h3-sub { margin-top: 2px; font-size: var(--h3-fs-2xs); color: var(--dsw-alias-label-secondary); }
.h3-sec { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--dsw-alias-border-l1); }
.h3-h { font-size: var(--h3-fs-xs); font-weight: 600; }
.h3-hline { display: flex; align-items: baseline; gap: 8px; }
.h3-hint { font-size: var(--h3-fs-2xs); color: var(--dsw-alias-label-secondary); }
.h3-note { margin-top: 6px; font-size: var(--h3-fs-2xs); color: var(--dsw-alias-label-secondary); }
.h3-row { display: flex; gap: 8px; margin-top: 8px; }
.h3-row-center { align-items: center; }
.h3-lab { flex: none; width: 84px; font-size: var(--h3-fs-2xs); color: var(--dsw-alias-label-secondary); }
.h3-ctl { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; }
.h3-inline { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.h3-inline-lab { font-size: var(--h3-fs-2xs); color: var(--dsw-alias-label-secondary); }
.h3-input { height: 26px; min-width: 0; flex: 1; padding: 0 8px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); color: color-mix(in srgb, var(--dsw-alias-label-primary) 85%, var(--dsw-alias-bg-base)); font-size: var(--h3-fs-xs); outline: none; box-sizing: border-box; }
.h3-input:focus { border-color: var(--dsw-alias-border-selected, var(--dsw-alias-brand-primary)); box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, transparent); }
.h3-select { flex: none; }
.h3-textarea { height: auto; padding: 6px 8px; resize: vertical; width: 100%; font-size: var(--h3-fs-xs); line-height: 1.55; }
.h3-seg { display: inline-flex; padding: 2px; gap: 2px; border-radius: 11px; background: var(--dsw-alias-bg-layer-2); }
.h3-seg-btn { height: 22px; padding: 0 10px; border: 0; border-radius: 9px; background: transparent; color: var(--dsw-alias-label-secondary); font-size: var(--h3-fs-2xs); cursor: pointer; }
.h3-seg-btn.on { background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); color: color-mix(in srgb, var(--dsw-alias-label-primary) 85%, var(--dsw-alias-bg-base)); box-shadow: 0 0 0 1px var(--dsw-alias-border-l2); }
.h3-btn { height: 22px; padding: 0 8px; border-radius: 5px; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); color: color-mix(in srgb, var(--dsw-alias-label-primary) 85%, var(--dsw-alias-bg-base)); font-size: var(--h3-fs-2xs); cursor: pointer; white-space: nowrap; }
.h3-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--dsw-alias-label-primary) 7%, var(--dsw-alias-bg-layer-2)); }
.h3-btn:disabled { opacity: .55; cursor: default; }
.h3-btn.primary { background: var(--dsw-alias-bg-layer-2); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 22%, var(--dsw-alias-bg-layer-2)); border-color: var(--dsw-alias-border-l2); border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, var(--dsw-alias-border-l2)); color: var(--dsw-alias-label-primary); color: color-mix(in srgb, var(--dsw-alias-label-primary) 88%, var(--dsw-alias-brand-primary)); font-weight: 600; }
.h3-btn.primary:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 30%, var(--dsw-alias-bg-layer-2)); border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-label-primary); color: color-mix(in srgb, var(--dsw-alias-label-primary) 88%, var(--dsw-alias-brand-primary)); opacity: 1; }
.h3-btn.warn { border-color: var(--dsw-alias-state-warn-primary); color: var(--dsw-alias-state-warn-primary); }
.h3-btn.danger { border-color: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); }
.h3-toggle { position: relative; width: 30px; height: 16px; flex: none; border: 0; border-radius: 8px; background: var(--dsw-alias-border-l2); cursor: pointer; padding: 0; }
.h3-toggle.on { background: var(--dsw-alias-label-primary); }
.h3-toggle-knob { position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: var(--dsw-alias-bg-layer-1); transition: left .12s ease; }
.h3-toggle.on .h3-toggle-knob { left: 16px; }
.h3-chips { display: flex; gap: 6px; flex-wrap: wrap; align-items: flex-end; }
.h3-chips.disabled { opacity: .45; pointer-events: none; }
.h3-chip { width: 30px; padding: 3px 0 0; border: 1px solid var(--dsw-alias-border-l2); border-radius: 7px; background: var(--dsw-alias-bg-layer-2); cursor: pointer; display: flex; flex-direction: column; align-items: center; }
.h3-chip.on { border-color: var(--dsw-alias-border-selected, var(--dsw-alias-brand-primary)); background: var(--dsw-alias-bg-layer-1); }
.h3-chip-box { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; }
.h3-chip-shape { border: 1.2px solid var(--dsw-alias-label-secondary); border-radius: 1.5px; }
.h3-chip.on .h3-chip-shape { border-color: var(--dsw-alias-label-primary); color: color-mix(in srgb, var(--dsw-alias-label-primary) 85%, var(--dsw-alias-bg-base)); }
.h3-chip-adaptive { font-size: var(--h3-fs-2xs); color: var(--dsw-alias-label-secondary); }
.h3-chip-lab { margin-top: 2px; font-size: var(--h3-fs-2xs); color: var(--dsw-alias-label-secondary); }
.h3-chip.on .h3-chip-lab { color: var(--dsw-alias-label-primary); color: color-mix(in srgb, var(--dsw-alias-label-primary) 85%, var(--dsw-alias-bg-base)); font-weight: 600; }
.h3-keyline { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; width: 100%; }
.h3-keyline .h3-input { flex: 1 1 240px; min-width: 200px; }
.h3-keyline.saved .h3-input::placeholder { color: var(--dsw-alias-state-success-primary); opacity: .9; }

.h3-msg { margin-top: 6px; font-size: var(--h3-fs-2xs); padding: 4px 8px; border-radius: 6px; background: var(--dsw-alias-bg-layer-2); }
.h3-msg.good { color: var(--dsw-alias-state-success-primary); }
.h3-msg.bad { color: var(--dsw-alias-state-error-primary); }
.h3-actions { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; align-items: center; }
.h3-actions.end { justify-content: flex-end; }
.h3-morewrap { position: relative; display: inline-flex; }
.h3-morewrap .h3-menu { left: 0; right: auto; top: calc(100% + 4px); z-index: 20; }
.h3-menu-fixed { position: fixed; z-index: 80; min-width: 170px; max-height: 280px; overflow: auto; }
.h3-menu { position: absolute; z-index: 5; top: 100%; left: 0; margin-top: 4px; padding: 4px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 7px; background: var(--dsw-alias-bg-overlay, var(--dsw-alias-bg-layer-1)); box-shadow: 0 6px 18px color-mix(in srgb, var(--dsw-alias-label-primary) 16%, transparent); display: flex; flex-direction: column; min-width: 130px; }
.h3-menu button { text-align: left; border: 0; background: transparent; color: var(--dsw-alias-label-primary); color: color-mix(in srgb, var(--dsw-alias-label-primary) 85%, var(--dsw-alias-bg-base)); font-size: var(--h3-fs-2xs); padding: 5px 8px; border-radius: 5px; cursor: pointer; white-space: nowrap; }
.h3-menu button:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2); }
.h3-menu button:disabled { opacity: .45; cursor: default; }
.h3-refs { margin-top: 8px; }
.h3-ref-line { display: block; }
.h3-ref-line.labelled { display: flex; align-items: center; gap: 16px; padding-left: 24px; }
.h3-ref-line.labelled .h3-ref-grid { flex: 0 1 auto; min-width: 0; }
.h3-ref-line.labelled .h3-ref-edit-hint { margin-left: 28px; flex: none; }
.h3-ref-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.h3-ref-grid-labelled { gap: 16px; align-items: flex-start; }
.h3-ref-card { width: 108px; display: flex; flex-direction: column; align-items: center; }
.h3-ref-grid-labelled .h3-ref-index { display: none; }
.h3-ref-grid-labelled .h3-ref-addwrap { display: flex; flex-direction: column; align-items: center; }
.h3-ref-grid-labelled .h3-menu { top: 50%; bottom: auto; left: calc(100% + 6px); right: auto; margin-top: 0; transform: translateY(-50%); }
.h3-ref-slot { position: relative; width: 72px; aspect-ratio: 3 / 4; height: auto; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsw-alias-bg-layer-2); padding: 0; box-sizing: border-box; overflow: hidden; }
.h3-ref-thumb { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform .18s ease; }
.h3-ref-video { z-index: 1; background: #000; }
.h3-ref-media-icon, .h3-ref-audio { position: absolute; inset: 0; z-index: 0; display: flex; align-items: center; justify-content: center; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); }
.h3-ref-media-icon svg { opacity: .75; }
.h3-ref-audio { z-index: 1; color: var(--dsw-alias-brand-primary); }
.h3-ref-audio svg { opacity: .9; }
.h3-ref-play { position: absolute; z-index: 2; left: 50%; top: 50%; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; transform: translate(-50%, -50%); border: 1px solid color-mix(in srgb, #fff 35%, transparent); border-radius: 999px; background: color-mix(in srgb, #000 52%, transparent); backdrop-filter: blur(3px); color: #fff; pointer-events: none; }
.h3-ref-video-badge { position: absolute; left: 3px; bottom: 3px; z-index: 2; padding: 1px 4px; border-radius: 4px; background: color-mix(in srgb, #000 58%, transparent); color: #fff; font-size: var(--h3-fs-2xs); line-height: 1.2; }
.h3-ref-slot:hover .h3-ref-thumb { transform: scale(1.035); }
.h3-ref-index { position: absolute; top: 3px; left: 3px; z-index: 2; display: block; min-width: 13px; padding: 1px 3px; border: 1px solid color-mix(in srgb, var(--dsw-alias-border-l2) 55%, transparent); border-radius: 4px; background: color-mix(in srgb, var(--dsw-alias-bg-base) 72%, transparent); font-size: var(--h3-fs-2xs); line-height: 1.1; text-align: center; color: var(--dsw-alias-label-secondary); backdrop-filter: blur(4px); }
.h3-ref-x { position: absolute; top: 3px; right: 3px; z-index: 3; width: 20px; height: 20px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border: 1px solid color-mix(in srgb, #fff 22%, transparent); border-radius: 999px; background: color-mix(in srgb, #000 46%, transparent); backdrop-filter: blur(5px); color: #fff; cursor: pointer; opacity: .86; transition: background .15s ease, border-color .15s ease, color .15s ease, opacity .15s ease, transform .12s ease; }
.h3-ref-x:hover { border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary) 70%, #fff); background: var(--dsw-alias-state-error-primary); color: #fff; opacity: 1; transform: scale(1.06); }
.h3-ref-x:active { transform: scale(.94); }
.h3-ref-name { position: absolute; left: 4px; right: 4px; bottom: 4px; z-index: 2; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; padding: 3px; border-radius: 3px; background: color-mix(in srgb, var(--dsw-alias-bg-base) 76%, transparent); font-size: var(--h3-fs-2xs); line-height: 1.3; word-break: break-all; color: var(--dsw-alias-label-secondary); }
.h3-ref-addwrap { position: relative; }
.h3-ref-addwrap .h3-menu { z-index: 20; }
.h3-ref-addwrap .h3-menu button { font-size: var(--h3-fs-xs); padding: 6px 8px; }
.h3-refs-audio .h3-menu { top: auto; bottom: calc(100% + 4px); margin-top: 0; }
.h3-ref-add { width: 72px; aspect-ratio: 3 / 4; height: auto; border: 1px dashed var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); font-size: var(--h3-fs-2xl); cursor: pointer; }
.h3-ref-text { display: flex; gap: 6px; margin-top: 6px; align-items: center; }
.h3-refgroups { margin-top: 8px; display: grid; grid-template-columns: max-content minmax(0, 1fr); column-gap: 12px; row-gap: 10px; align-items: center; }
.h3-refgroup { display: contents; }
.h3-refgroup .h3-lab { width: auto; padding-top: 0; white-space: nowrap; }
.h3-refgroup .h3-refs { margin-top: 0; min-width: 0; }
.h3-ref-body { display: flex; align-items: center; gap: 16px; min-width: 0; }
.h3-ref-body .h3-refs { flex: 0 1 auto; min-width: 0; margin-top: 0; }
.h3-ref-hint { flex: 0 1 auto; min-width: 0; margin-left: 52px; font-size: var(--h3-fs-md); line-height: 1.4; color: var(--dsw-alias-label-secondary); }
.h3-modes { display: flex; align-items: center; gap: 4px; margin-top: 8px; }
.h3-mode-wrap { display: inline-flex; align-items: center; gap: 4px; }
.h3-mode-pill { height: 22px; padding: 0 11px; border-radius: 11px; background: var(--dsw-alias-bg-layer-2); box-shadow: inset 0 0 0 1px var(--dsw-alias-border-l2); display: inline-flex; align-items: center; font-size: var(--h3-fs-2xs); }
.h3-mode-link { border: 0; background: transparent; color: var(--dsw-alias-label-secondary); font-size: var(--h3-fs-2xs); padding: 0 4px; cursor: pointer; }
.h3-mode-link:hover { color: var(--dsw-alias-label-primary); color: color-mix(in srgb, var(--dsw-alias-label-primary) 85%, var(--dsw-alias-bg-base)); }
.h3-mode-sep { width: 1px; height: 12px; background: var(--dsw-alias-border-l2); margin: 0 4px; }
.h3-video-body { margin-top: 8px; }
.h3-promptrow { display: flex; }
.h3-optline { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.h3-frame-row { display: flex; gap: 16px; margin-top: 8px; flex-wrap: wrap; align-items: center; }
.h3-frame-hint { font-size: var(--h3-fs-md); color: var(--dsw-alias-label-secondary); }
.h3-frame { width: 108px; display: flex; flex-direction: column; align-items: center; }
.h3-frame-lab { width: 100%; font-size: var(--h3-fs-2xs); text-align: center; color: var(--dsw-alias-label-secondary); margin-bottom: 4px; }
.h3-frame-add { width: 72px; aspect-ratio: 3 / 4; height: auto; border: 1px dashed var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); font-size: var(--h3-fs-2xl); cursor: pointer; }
.h3-frame-filled { width: 72px; aspect-ratio: 3 / 4; height: auto; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsw-alias-bg-layer-2); padding: 4px; box-sizing: border-box; position: relative; overflow: hidden; }

.h3-linkbtn { border: 0; background: transparent; color: var(--dsw-alias-label-secondary); font-size: var(--h3-fs-2xs); padding: 0; cursor: pointer; }
.h3-linkbtn:hover { color: var(--dsw-alias-label-primary); color: color-mix(in srgb, var(--dsw-alias-label-primary) 85%, var(--dsw-alias-bg-base)); }
.h3-video-params { margin-top: 10px; }
.h3-alertbar { display: flex; align-items: center; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.h3-bell { width: 30px; height: 30px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 7px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.h3-bell:hover { background: var(--dsw-alias-card-fill-hover, var(--dsw-alias-bg-layer-2)); }
.h3-alertname { font-size: var(--h3-fs-2xs); }
.h3-alertstate { font-size: var(--h3-fs-2xs); color: var(--dsw-alias-label-secondary); }
.h3-alertstate.on { color: var(--dsw-alias-state-warn-primary); }
.h3-empty { padding: 20px 0; color: var(--dsw-alias-label-secondary); }
[data-composer-dock]:has(.h3-dock) { position: relative; width: 100%; justify-content: center; }
.h3-dock { position: absolute; left: calc(-1 * var(--dsh-composer-side-clearance, 0px) + 12px); top: 50%; transform: translateY(-50%); display: inline-flex; align-items: center; box-sizing: border-box; gap: 6px; margin: 0; padding: 1px 0; height: calc(22px + var(--dsh-content-font-delta-secondary, 0px)); line-height: calc(20px + var(--dsh-content-font-delta-secondary, 0px)); font-size: calc(var(--dsh-content-font-size-secondary, 13px) - 1px); color: var(--dsw-alias-label-secondary); cursor: pointer; user-select: none; white-space: nowrap; }
.h3-dock:hover { color: var(--dsw-alias-label-primary); color: color-mix(in srgb, var(--dsw-alias-label-primary) 85%, var(--dsw-alias-bg-base)); }
.h3-dock.warn, .h3-dock.warn b, .h3-dock.warn .h3-dock-brand { color: var(--dsw-alias-state-warn-primary); }
.h3-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-state-success-primary); flex: none; }
.h3-dock.warn .h3-dot { background: var(--dsw-alias-state-warn-primary); }
.h3-dock b { font-weight: 600; color: var(--dsw-alias-label-primary); color: color-mix(in srgb, var(--dsw-alias-label-primary) 85%, var(--dsw-alias-bg-base)); }

.h3-back { position: fixed; inset: 0; z-index: 100000; background: transparent; }
.h3-back.dim { background: color-mix(in srgb, var(--dsw-alias-bg-base) 45%, transparent); }
.h3-pop { position: fixed; left: 24px; bottom: 96px; width: 380px; max-width: calc(100vw - 32px); z-index: 100001; border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; background: var(--dsw-alias-bg-overlay, var(--dsw-alias-bg-layer-1)); box-shadow: 0 12px 32px color-mix(in srgb, var(--dsw-alias-label-primary) 18%, transparent); padding: 14px; font-size: var(--h3-fs-md); }
.h3-pop-head { display: flex; justify-content: space-between; align-items: baseline; }
.h3-pop-title { font-size: var(--h3-fs-sm); font-weight: 600; }
.h3-pop-row { display: flex; align-items: baseline; gap: 8px; margin-top: 6px; }
.h3-pop-row > span:first-child { flex: none; width: 76px; font-size: var(--h3-fs-2xs); color: var(--dsw-alias-label-secondary); }
.h3-pop-row .h3-hint { flex: 1; }
.h3-pop-row.big { margin-top: 10px; }
.h3-pop-row.big b { margin-left: auto; font-size: var(--h3-fs-2xl); }
.h3-pop-value { margin-left: auto; }
.h3-divider { height: 1px; margin: 9px 0; background: var(--dsw-alias-border-l1); }
.h3-dialog { position: fixed; z-index: 100001; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 360px; max-width: calc(100vw - 32px); border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; background: var(--dsw-alias-bg-overlay, var(--dsw-alias-bg-layer-1)); box-shadow: 0 12px 32px color-mix(in srgb, var(--dsw-alias-label-primary) 20%, transparent); padding: 16px; font-size: var(--h3-fs-md); }
.h3-dialog-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 10px; font-size: var(--h3-fs-xs); }
.h3-card { border: 1px solid var(--dsw-alias-border-l2); border-radius: 9px; background: var(--dsw-alias-card-fill, var(--dsw-alias-bg-layer-1)); padding: 9px; max-width: 560px; font-size: var(--h3-fs-2xs); }
.h3-card.warn { border-color: var(--dsw-alias-state-warn-primary); }
.h3-card.info { border-color: var(--dsw-alias-border-selected, var(--dsw-alias-brand-primary)); }
.h3-card-title { font-size: var(--h3-fs-2xs); font-weight: 600; }
.h3-card-line { margin-top: 4px; color: var(--dsw-alias-label-secondary); overflow-wrap: anywhere; }
.h3-card-line.dim { opacity: .8; }
.h3-card-warn { margin-top: 5px; font-size: var(--h3-fs-2xs); color: var(--dsw-alias-state-warn-primary); }
.h3-progress { height: 4px; border-radius: 2px; background: var(--dsw-alias-bg-layer-2); margin-top: 7px; overflow: hidden; }
.h3-progress-bar { display: block; height: 100%; width: 40%; border-radius: 2px; background: var(--dsw-alias-brand-primary); animation: h3-slide 1.6s ease-in-out infinite; }
@keyframes h3-slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }
.h3-spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid var(--dsw-alias-border-l2); border-top-color: var(--dsw-alias-brand-primary); border-radius: 50%; animation: h3-spin .8s linear infinite; vertical-align: middle; }
@keyframes h3-spin { to { transform: rotate(360deg); } }
.h3-thumbs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.h3-thumb { position: relative; width: 78px; height: 78px; border-radius: 6px; overflow: hidden; background: var(--dsw-alias-bg-layer-2); display: block; }
.h3-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.h3-thumb-cap { position: absolute; left: 0; right: 0; bottom: 0; padding: 1px 3px; font-size: var(--h3-fs-2xs); text-align: center; color: var(--dsw-alias-bg-base); background: color-mix(in srgb, var(--dsw-alias-label-primary) 55%, transparent); }
.h3-videorow { display: flex; gap: 10px; align-items: flex-start; }
.h3-videotile { width: 92px; height: 58px; flex: none; border: 0; border-radius: 6px; background: var(--dsw-alias-label-primary); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.h3-play { width: 0; height: 0; border-top: 6px solid transparent; border-bottom: 6px solid transparent; border-left: 10px solid var(--dsw-alias-bg-base); margin-left: 2px; }
.h3-videoinfo { flex: 1; min-width: 0; }
.h3-listrow { display: flex; gap: 8px; align-items: baseline; padding: 3px 0; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.h3-listrow:last-child { border-bottom: 0; }
.h3-listkind { width: 52px; color: var(--dsw-alias-label-secondary); font-size: var(--h3-fs-2xs); }
.h3-listid { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--h3-fs-2xs); }
.h3-liststatus { width: 64px; font-size: var(--h3-fs-2xs); color: var(--dsw-alias-label-secondary); }
.h3-listcost { width: 52px; text-align: right; font-size: var(--h3-fs-2xs); }
/* Settings readability: a clearly larger scale than the compact card UI. */
.h3-settings { font-size: var(--h3-fs-lg); }
.h3-settings .h3-formcardbody .h3-input:not(.h3-textarea) { max-width: min(370px, 100%); font-size: var(--h3-fs-lg); height: 32px; }
.h3-settings.h3-settingspage { height: 100%; min-height: 0; display: flex; flex-direction: column; padding: 0; }
.h3-settings-scroll { flex: 1; min-height: 0; overflow: auto; padding: 2px 2px 12px; }
.h3-settingsfoot { flex: none; display: flex; align-items: center; gap: 10px; padding: 12px 0 0; border-top: 1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 22%, var(--dsw-alias-border-l1)); background: var(--dsw-alias-bg-base); }
.h3-settingsfoot .h3-btn.primary { min-width: 104px; height: 34px; padding: 0 16px; font-size: var(--h3-fs-lg); font-weight: 700; border-width: 1px; border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 35%, var(--dsw-alias-border-l2)); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 24%, var(--dsw-alias-bg-layer-2)); box-shadow: 0 2px 8px color-mix(in srgb, var(--dsw-alias-brand-primary) 6%, transparent); }
.h3-settingsfoot .h3-btn.primary:hover:not(:disabled) { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 34%, var(--dsw-alias-bg-layer-2)); border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 48%, var(--dsw-alias-border-l2)); }
.h3-settingsfoot .h3-hint, .h3-settingsfoot .h3-msg { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.h3-statuscard { display: flex; align-items: center; gap: 10px; margin-top: 10px; padding: 10px 12px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px; background: var(--dsw-alias-bg-layer-1); overflow: hidden; }
.h3-statuscard.warn { border-color: var(--dsw-alias-state-warn-primary); }
.h3-statusmain { flex: 1 1 auto; min-width: 120px; display: flex; flex-direction: column; gap: 1px; }
.h3-statusmain b { font-size: var(--h3-fs-md); color: var(--dsw-alias-label-primary); color: color-mix(in srgb, var(--dsw-alias-label-primary) 85%, var(--dsw-alias-bg-base)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.h3-statusmain span { font-size: var(--h3-fs-xs); color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.h3-statusmeta { flex: 0 1 42%; min-width: 0; max-width: 42%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: right; font-size: var(--h3-fs-2xs); color: var(--dsw-alias-label-secondary); }
.h3-del-overlay { position: fixed; inset: 0; z-index: 100000; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(0, 0, 0, .45); }
.h3-del-dialog { width: min(380px, 100%); padding: 16px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); color: color-mix(in srgb, var(--dsw-alias-label-primary) 85%, var(--dsw-alias-bg-base)); font-size: var(--h3-fs-lg); box-shadow: 0 16px 48px rgba(0, 0, 0, .35); }
.h3-del-title { font-size: var(--h3-fs-xl); font-weight: 600; }
.h3-del-text { margin-top: 6px; font-size: var(--h3-fs-md); color: var(--dsw-alias-label-secondary); word-break: break-all; }
.h3-del-warn { margin-top: 8px; font-size: var(--h3-fs-sm); color: var(--dsw-alias-state-warn-primary); }
.h3-del-check { display: flex; align-items: center; gap: 8px; margin-top: 14px; font-size: var(--h3-fs-lg); cursor: pointer; }
.h3-del-check input { width: 16px; height: 16px; accent-color: var(--dsw-alias-brand-primary); }
.h3-del-hint { margin-top: 6px; font-size: var(--h3-fs-sm); color: var(--dsw-alias-label-secondary); }
.h3-del-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.h3-del-dialog .h3-btn { font-size: var(--h3-fs-md); height: 30px; padding: 0 12px; }
.h3 button:focus-visible, .h3-input:focus-visible, .h3-chip:focus-visible, .h3-taskthumb:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .h3-progress i, .h3-skeleton span { animation: none; }
}
.h3-settings .h3-title { font-size: var(--h3-fs-2xl); }
.h3-settings .h3-sub { font-size: var(--h3-fs-lg); }
.h3-settings .h3-h { font-size: var(--h3-fs-lg); }
.h3-settings .h3-hint { font-size: var(--h3-fs-md); }
.h3-settings .h3-note { font-size: var(--h3-fs-md); }
.h3-settings .h3-lab { font-size: var(--h3-fs-lg); }
.h3-settings .h3-inline-lab { font-size: var(--h3-fs-md); }
.h3-settings .h3-input { font-size: var(--h3-fs-lg); height: 34px; }
.h3-settings .h3-textarea { font-size: var(--h3-fs-lg); height: auto; }
.h3-settings .h3-seg-btn { font-size: var(--h3-fs-md); height: 30px; }
.h3-settings .h3-btn { font-size: var(--h3-fs-lg); height: 30px; }
.h3-settings .h3-chips { gap: 12px; }
.h3-settings .h3-chip { width: 44px; padding: 4px 0 0; }
.h3-settings .h3-chip-box { width: 26px; height: 26px; }
.h3-settings .h3-chip-shape { border-width: 1.5px; }
.h3-settings .h3-chip-lab { font-size: var(--h3-fs-md); margin-top: 3px; }

.h3-settings .h3-msg { font-size: var(--h3-fs-lg); }
.h3-settings .h3-ref-index,
.h3-settings .h3-ref-name { font-size: var(--h3-fs-sm); }
.h3-settings .h3-mode-pill,
.h3-settings .h3-mode-link { font-size: var(--h3-fs-md); height: 30px; }
.h3-settings .h3-frame-lab { font-size: var(--h3-fs-md); }
.h3-settings .h3-linkbtn { font-size: var(--h3-fs-sm); }
.h3-settings .h3-alertname { font-size: var(--h3-fs-lg); }
.h3-settings .h3-alertstate { font-size: var(--h3-fs-md); }
/* Detail popover and alert dialog readability. */
.h3-pop .h3-pop-title, .h3-dialog .h3-pop-title { font-size: var(--h3-fs-xl); }
.h3-pop .h3-pop-row { font-size: var(--h3-fs-md); }
.h3-pop .h3-pop-row > span:first-child { width: 88px; font-size: var(--h3-fs-sm); }
.h3-pop .h3-pop-row.big b { font-size: var(--h3-fs-3xl); }
.h3-pop .h3-pop-value { font-size: var(--h3-fs-md); }
.h3-pop .h3-hint { font-size: var(--h3-fs-sm); }
.h3-pop .h3-note { font-size: var(--h3-fs-sm); }
.h3-pop .h3-btn, .h3-dialog .h3-btn { font-size: var(--h3-fs-sm); height: 26px; }
.h3-dialog .h3-dialog-row { font-size: var(--h3-fs-md); }
.h3-dialog .h3-input { font-size: var(--h3-fs-md); height: 30px; }
.h3-dialog .h3-note { font-size: var(--h3-fs-xs); }
/* Right-sidebar workspace */
.h3-tab { height: 100%; min-height: 0; display: flex; flex-direction: column; background: var(--dsw-alias-bg-base); }
.h3-tabhead { flex: none; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; row-gap: 6px; padding: 10px 12px 8px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.h3-tabpill { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 999px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); font-size: var(--h3-fs-sm); line-height: 1.4; cursor: pointer; white-space: nowrap; }
.h3-tabpill:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, var(--dsw-alias-bg-layer-2)); color: var(--dsw-alias-label-primary); }
.h3-tabpill .h3-dot { flex: none; }
.h3-tabpill .h3-tab-brand { font-size: var(--h3-fs-md); font-weight: 600; color: var(--dsw-alias-label-primary); color: color-mix(in srgb, var(--dsw-alias-label-primary) 85%, var(--dsw-alias-bg-base)); }
.h3-tabpill .h3-tabbalance-text,
.h3-tabpill .h3-tabbalance-label,
.h3-tabpill .h3-tabbalance-sep,
.h3-tabpill b { font-size: var(--h3-fs-sm); line-height: 1.4; }
.h3-tabpill b { font-weight: 600; color: var(--dsw-alias-label-primary); color: color-mix(in srgb, var(--dsw-alias-label-primary) 85%, var(--dsw-alias-bg-base)); }
.h3-tabpill.warn { color: var(--dsw-alias-state-warn-primary); border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 45%, var(--dsw-alias-border-l2)); }
.h3-tabpill.warn b { color: var(--dsw-alias-state-warn-primary); }
.h3-tabhead .h3-dot { align-self: center; }
.h3-dot.warn { background: var(--dsw-alias-state-warn-primary); }
.h3-tabtitle { font-size: var(--h3-fs-2xl); font-weight: 700; }
.h3-tabbalance { font-size: var(--h3-fs-xl); font-weight: 700; }
.h3-tabwarn { font-size: var(--h3-fs-sm); color: var(--dsw-alias-state-warn-primary); }
.h3-tabspacer { flex: 1; }
.h3-tabrefresh { width: 28px; height: 28px; padding: 0; border: 1px solid var(--dsw-alias-border-l2); border-radius: 7px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.h3-tabrefresh:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 7%, var(--dsw-alias-bg-layer-2)); color: var(--dsw-alias-label-primary); }
.h3-subtabs { flex: none; display: flex; gap: 6px; padding: 8px 14px 0; }
.h3-subtab:focus-visible, .h3-tabpill:focus-visible, .h3-tabrefresh:focus-visible, .h3-menu button:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
.h3-subtab { position: relative; height: 34px; padding: 0 14px; border: 0; border-radius: 0; background: transparent; color: var(--dsw-alias-label-secondary); font-size: var(--h3-fs-xl); cursor: pointer; display: inline-flex; align-items: center; gap: 5px; }
.h3-subtab svg { flex: none; }
.h3-subtab:not(.on):hover { color: var(--dsw-alias-label-primary); background: transparent; }
.h3-subtab.on { background: transparent; color: var(--dsw-alias-label-primary); color: color-mix(in srgb, var(--dsw-alias-label-primary) 85%, var(--dsw-alias-bg-base)); font-weight: 400; font-stretch: normal; box-shadow: none; }
.h3-subtab.on::after { content: ''; position: absolute; left: 14px; right: 14px; bottom: 2px; height: 2px; border-radius: 1px; background: var(--dsw-alias-brand-primary); }
.h3-tabbody { flex: 1; min-height: 0; overflow: auto; padding: 14px; }
.h3-tab .h3-settings { max-width: none; padding: 0 0 20px; }
.h3-tab .h3-settings.h3-newform, .h3-tab .h3-settings.h3-settingspage { padding-bottom: 0; }
.h3-tab .h3-settings .h3-title, .h3-tab .h3-settings .h3-sub { display: none; }
.h3-tasklist { display: flex; flex-direction: column; gap: 10px; }
.h3-task { border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px; padding: 10px; background: var(--dsw-alias-card-fill, var(--dsw-alias-bg-layer-1)); font-size: var(--h3-fs-lg); }
.h3-task.warn { border-color: var(--dsw-alias-state-warn-primary); }
.h3-taskhead { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
.h3-taskkind { font-size: var(--h3-fs-md); text-transform: uppercase; letter-spacing: .04em; color: var(--dsw-alias-label-secondary); }
.h3-taskmodel { font-weight: 600; }

.h3-taskcost { margin-left: auto; font-size: var(--h3-fs-lg); }
.h3-taskprompt { margin-top: 5px; font-size: var(--h3-fs-lg); color: var(--dsw-alias-label-secondary); overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.h3-taskmedia { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.h3-history { display: flex; flex-direction: column; gap: 10px; }
.h3-filters { display: flex; flex-wrap: wrap; gap: 6px; }
.h3-autopoll { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 10px; margin-bottom: 8px; padding: 5px 8px; border-radius: 6px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); font-size: var(--h3-fs-xs); line-height: 1.4; }
.h3-autopoll.bad { color: var(--dsw-alias-state-error-primary); }
.h3-autopoll b { color: var(--dsw-alias-state-warn-primary); font-weight: 500; }
.h3-filter { display: inline-flex; align-items: center; justify-content: center; gap: 4px; height: 30px; padding: 0 11px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 999px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); font-size: var(--h3-fs-md); line-height: 1; cursor: pointer; }
.h3-filter span { font-size: var(--h3-fs-sm); line-height: 1; opacity: .65; }
.h3-filter.on { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-brand-primary); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, var(--dsw-alias-bg-layer-2)); }
.h3-status { font-size: var(--h3-fs-2xs); font-weight: 600; padding: 1px 7px; border-radius: 999px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); white-space: nowrap; }
.h3-status.ok { color: var(--dsw-alias-state-success-primary); background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 12%, transparent); }
.h3-status.bad { color: var(--dsw-alias-state-error-primary); background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent); }
.h3-status.run { color: var(--dsw-alias-brand-primary); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent); }
.h3-tasktime { font-size: var(--h3-fs-xs); color: var(--dsw-alias-label-secondary); }
.h3-runmeta { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 2px 8px; margin-top: 3px; font-size: var(--h3-fs-xs); color: var(--dsw-alias-label-secondary); }
.h3-progress { height: 4px; border-radius: 2px; background: var(--dsw-alias-bg-layer-2); overflow: hidden; margin-top: 8px; }
.h3-progress i { display: block; height: 100%; width: 35%; border-radius: 2px; background: var(--dsw-alias-brand-primary); animation: h3pulse 1.1s ease-in-out infinite alternate; }
@keyframes h3pulse { from { opacity: .4; } to { opacity: 1; } }
.h3-skeleton { height: 108px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px; background: var(--dsw-alias-bg-layer-1); padding: 12px; display: flex; flex-direction: column; gap: 9px; }
.h3-skeleton span { display: block; height: 10px; width: 70%; border-radius: 4px; background: linear-gradient(90deg, var(--dsw-alias-bg-layer-2), var(--dsw-alias-bg-layer-1), var(--dsw-alias-bg-layer-2)); background-size: 200% 100%; animation: h3shimmer 1.2s linear infinite; }
.h3-skeleton span:last-child { width: 45%; }
@keyframes h3shimmer { to { background-position: -200% 0; } }
.h3-historyempty { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; padding: 28px 10px; border: 1px dashed var(--dsw-alias-border-l2); border-radius: 10px; }
.h3-historyempty b { font-size: var(--h3-fs-lg); }
.h3-historyempty span { font-size: var(--h3-fs-sm); line-height: 1.5; max-width: 280px; color: var(--dsw-alias-label-secondary); }
.h3-taskthumb { width: 86px; height: 86px; border-radius: 6px; overflow: hidden; background: var(--dsw-alias-bg-layer-2); display: block; }
.h3-taskthumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.h3-taskvideo { position: relative; width: 110px; height: 62px; border: 0; border-radius: 6px; background: var(--dsw-alias-label-primary); color: var(--dsw-alias-bg-base); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.h3-taskvideo-cap { position: absolute; left: 4px; right: 4px; bottom: 3px; font-size: var(--h3-fs-2xs); text-align: center; color: var(--dsw-alias-bg-base); }
.h3-big { font-size: var(--h3-fs-4xl); font-weight: 700; margin-bottom: 2px; }
.h3-balance-expand { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--dsw-alias-border-l1); }
.h3-balancepanel .h3-row { margin-top: 10px; }
.h3-balance-row { display: flex; align-items: baseline; gap: 8px; padding: 4px 0; border-bottom: 1px solid var(--dsw-alias-border-l1); font-size: var(--h3-fs-xs); }
.h3-balance-row:last-child { border-bottom: 0; }
.h3-balance-cost { margin-left: auto; }
.h3-task .h3-msg { margin-top: 6px; }
.h3-newform { display: flex; flex-direction: column; height: 100%; min-height: 0; gap: 0; }
.h3-tab .h3-newform { padding-bottom: 0; }
.h3-newform-scroll { flex: 1; min-height: 0; overflow: auto; padding: 0 2px 10px 0; }
.h3-typecards { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
.h3-typecard { position: relative; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 38px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); text-align: center; cursor: pointer; }
.h3-typecard.on { border-color: var(--dsw-alias-brand-primary); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, var(--dsw-alias-bg-layer-2)); color: var(--dsw-alias-label-primary); }
.h3-typeicon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); width: 30px; height: 30px; border-radius: 8px; background: var(--dsw-alias-bg-layer-1); display: inline-flex; align-items: center; justify-content: center; flex: none; color: var(--dsw-alias-label-secondary); }
.h3-typecard.on .h3-typeicon { color: var(--dsw-alias-brand-primary); }
.h3-typetext { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 1px; min-width: 0; }
.h3-typetext b { font-size: var(--h3-fs-lg); font-weight: 600; color: var(--dsw-alias-label-primary); color: color-mix(in srgb, var(--dsw-alias-label-primary) 85%, var(--dsw-alias-bg-base)); }
.h3-typetext span { font-size: var(--h3-fs-xs); color: var(--dsw-alias-label-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.h3-formcard { margin-top: 10px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px; background: var(--dsw-alias-bg-layer-1); overflow: hidden; }
.h3-formcard:has(.h3-ref-line.labelled) { overflow: visible; }
.h3-formcardhead { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 8px 10px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.h3-formcardhead b { font-size: var(--h3-fs-lg); font-weight: 600; color: var(--dsw-alias-label-primary); color: color-mix(in srgb, var(--dsw-alias-label-primary) 85%, var(--dsw-alias-bg-base)); }
.h3-formcardhead span { font-size: var(--h3-fs-sm); color: var(--dsw-alias-label-secondary); }
.h3-formcardbody { padding: 10px; }
.h3-formcardbody .h3-row { margin-top: 14px; }
.h3-formcardbody .h3-row:first-child { margin-top: 0; }
.h3-formcardbody .h3-lab { width: 84px; }
.h3-formcardbody .h3-inline { gap: 10px; row-gap: 10px; }
.h3-formcardbody .h3-promptrow { margin-top: 10px; }
.h3-formcardbody .h3-optline { margin-top: 10px; gap: 10px; }
.h3-formcardbody .h3-frame-row { gap: 18px; margin-top: 12px; }
.h3-formcardbody .h3-refgroups { gap: 12px; margin-top: 12px; }
.h3-formcardbody .h3-note { margin-top: 8px; }
.h3-examples { display: flex; align-items: center; flex-wrap: nowrap; gap: 6px; margin-top: 8px; min-width: 0; }
.h3-examplelab { flex: none; height: 26px; display: inline-flex; align-items: center; font-size: var(--h3-fs-sm); line-height: 1; color: var(--dsw-alias-label-secondary); }
.h3-examplelist { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 6px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: thin; }
.h3-example { flex: none; height: 26px; display: inline-flex; align-items: center; padding: 0 10px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 999px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); font-size: var(--h3-fs-sm); line-height: 1; white-space: nowrap; cursor: pointer; }
.h3-example:hover { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-brand-primary); }
.h3-example-refresh { flex: none; width: 24px; height: 24px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); cursor: pointer; }
.h3-example-refresh:hover { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-brand-primary); }
.h3-submitbar { flex: none; display: flex; align-items: center; gap: 10px; padding: 10px 0 0; border-top: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-base); }
.h3-submitbar .h3-btn.primary { min-width: 104px; height: 34px; padding: 0 16px; font-size: var(--h3-fs-lg); font-weight: 700; }
.h3-submitinfo { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.h3-submitinfo b { font-size: var(--h3-fs-md); color: var(--dsw-alias-label-primary); color: color-mix(in srgb, var(--dsw-alias-label-primary) 85%, var(--dsw-alias-bg-base)); }
.h3-submitinfo span { font-size: var(--h3-fs-xs); color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.h3-submitmsg { color: var(--dsw-alias-state-error-primary) !important; }
.h3-kindrow { margin-bottom: 8px; }
.h3-newbody { margin-top: 6px; }
.h3-newbody .h3-row { margin-top: 18px; }
.h3-newbody .h3-row:has(.h3-chips) { margin-top: 22px; }
.h3-newbody .h3-row:has(.h3-inline) { margin-top: 20px; }
.h3-newbody .h3-modes { margin-top: 12px; }
.h3-newbody .h3-lab { width: 84px; }
.h3-newbody .h3-inline { gap: 10px; row-gap: 10px; }
.h3-newbody .h3-promptrow { margin-top: 12px; }
.h3-newbody .h3-optline { margin-top: 12px; gap: 10px; }
.h3-newbody .h3-frame-row { gap: 18px; margin-top: 16px; }
.h3-newbody .h3-refgroups { gap: 14px; margin-top: 16px; }
.h3-newbody .h3-note { margin-top: 10px; }
.h3-newbody .h3-actions { margin-top: 20px; gap: 8px; }
.h3-newform .h3-mode-pill, .h3-newform .h3-mode-link { font-size: var(--h3-fs-lg); }
.h3-newbody .h3-input, .h3-newbody .h3-select { min-height: 32px; }
.h3-newrefs { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--dsw-alias-border-l1); }
.h3-newdivider { height: 1px; margin: 14px 0 0; background: color-mix(in srgb, var(--dsw-alias-border-l2) 75%, transparent); }
.h3-newdivider + .h3-row { margin-top: 12px; }
@media (prefers-color-scheme: light) {
  html[data-ds-theme-source="system"] .h3-btn.primary { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 38%, var(--dsw-alias-bg-layer-2)); border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 70%, var(--dsw-alias-border-l2)); }
  html[data-ds-theme-source="system"] .h3-btn.primary:hover:not(:disabled) { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 48%, var(--dsw-alias-bg-layer-2)); }
}
@media (prefers-color-scheme: dark) {
  html[data-ds-theme-source="system"] .h3-toggle.on { background: color-mix(in srgb, var(--dsw-alias-label-primary) 78%, var(--dsw-alias-bg-base)); }
}
html[data-ds-theme-source="light"] .h3-btn.primary { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 38%, var(--dsw-alias-bg-layer-2)); border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 70%, var(--dsw-alias-border-l2)); }
html[data-ds-theme-source="light"] .h3-btn.primary:hover:not(:disabled) { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 48%, var(--dsw-alias-bg-layer-2)); }
html[data-ds-theme-source="dark"] .h3-toggle.on { background: color-mix(in srgb, var(--dsw-alias-label-primary) 78%, var(--dsw-alias-bg-base)); }
@media (max-width: 560px) {
  .h3-lab { width: 68px; }
  .h3-pop { left: 12px; right: 12px; bottom: 72px; width: auto; }
}
`

    // -------------------------------------------------------------- apply

    if (globalThis.__MINIMAX_H3_TEST__) {
      globalThis.__MINIMAX_H3_INTERNALS__ = { TaskRow, TaskPanel, DeleteDialog, RefSlots, SettingsPage, MiniMaxTab, hub }
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const localeService = ctx.get?.('locale')
        if (localeService?.getLocale) {
          const sync = () => {
            const snapshot = localeService.getLocale()
            activeLocale = String(snapshot?.active || '').toLowerCase().startsWith('en') ? 'en' : 'zh'
            hub.emit()
          }
          sync()
          try {
            ctx.effect(() => localeService.subscribe(sync))
          } catch {
            ctx.on?.('locale/change', sync)
          }
        }

        const getService = (name) => {
          try {
            return ctx.get?.(name) ?? ctx[name]
          } catch {
            return undefined
          }
        }
        const sidebarRightTabs = getService('sidebarRightTabs')
        const sidebarRight = getService('sidebarRight')
        openMiniMaxTab = () => {
          try {
            const right = getService('sidebarRight') || sidebarRight
            right?.openTab?.('minimax-h3')
          } catch (error) {
            console.warn('[minimax-h3] open right tab failed', error)
          }
        }
        if (sidebarRightTabs && typeof sidebarRightTabs.register === 'function') {
          try {
            ctx.effect(() =>
              sidebarRightTabs.register({
                id: 'dsh-minimax-h3',
                kind: 'minimax-h3',
                title: () => 'MiniMax',
                guide: [
                  {
                    id: 'minimax-h3',
                    order: 30,
                    title: () => 'MiniMax',
                    description: () => (currentLanguage() === 'en' ? 'Create, history & settings' : '创作、历史与设置'),
                    icon: MiniMaxLogo,
                  },
                ],
              }),
            )
          } catch (error) {
            console.warn('[minimax-h3] tab type registration failed', error)
          }
          ctx.slots.inject('sidebar.right.pane.tab', () =>
            ctx.slots.register({ name: 'sidebar.right.pane.tab', key: 'dsh-minimax-h3' }, MiniMaxTab),
          )
        } else {
          console.warn('[minimax-h3] right sidebar tab service unavailable; keeping standalone settings')
          ctx.slots.inject('settings.section', () =>
            ctx.slots.register({ name: 'settings.section', id: 'minimax-h3', order: 12, label: () => t('nav') }, SettingsPage),
          )
          ctx.slots.inject('conversation.composer.dock', () =>
            ctx.slots.register({ name: 'conversation.composer.dock', id: 'minimax-h3-balance', order: -1 }, Dock),
          )
          ctx.slots.inject('shell.overlay', () =>
            ctx.slots.register({ name: 'shell.overlay', id: 'minimax-h3-overlay', order: 50 }, Overlay),
          )
        }
        for (const toolName of [
          'minimax_h3_image',
          'minimax_h3_edit_image',
          'minimax_h3_video',
          'minimax_h3_enhance_prompt',
          'minimax_h3_media_status',
          'minimax_h3_media_list',
        ]) {
          const component = sidebarRightTabs
            ? ToolLauncher
            : toolName === 'minimax_h3_image' || toolName === 'minimax_h3_edit_image'
              ? ImageCard
              : toolName === 'minimax_h3_video'
                ? VideoCard
                : toolName === 'minimax_h3_enhance_prompt'
                  ? EnhanceCard
                  : toolName === 'minimax_h3_media_status'
                    ? StatusCard
                    : ListCard
          ctx.slots.inject('tool.call.toolview', () =>
            ctx.slots.register({ name: 'tool.call.toolview', key: toolName }, component),
          )
        }
      },
    }
  },
})
