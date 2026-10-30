# ShareX 與 before-you-do 停止／完成音效比較

日期：2026-10-31。這次提供比較，沒有替換 App 音效，也沒有變更使用者設定。

## 確認來源

本機 ShareX clone commit：`24b51dad5a71a39bcb72db6b57d174ccfc9bad2e`。

- [ScreenRecordManager.cs:390](https://github.com/ShareX/ShareX/blob/24b51dad5a71a39bcb72db6b57d174ccfc9bad2e/ShareX/ScreenRecordManager.cs#L390) 與 native 路徑 579 行在錄影結束時呼叫 `NotificationSound.ActionCompleted`。
- [TaskHelpers.cs:2219](https://github.com/ShareX/ShareX/blob/24b51dad5a71a39bcb72db6b57d174ccfc9bad2e/ShareX/TaskHelpers.cs#L2219) 依預設或自訂設定選音效；預設為 `ActionCompletedSound.wav`。
- 本機 ShareX 預設設定已唯讀確認：`PlaySoundAfterAction=true`、`UseCustomActionCompletedSound=false`、自訂路徑空白。未修改設定。
- 本 App 使用 `src-tauri/assets/recording-complete.wav`，在成功完成錄影／加入素材後播放；取消不播放。

## 原始 PCM 數據

| 項目 | A：ShareX ActionCompletedSound | B：before-you-do recording-complete |
| --- | --- | --- |
| 長度 | 0.3813 秒 | 0.3600 秒 |
| 取樣率 | 44,100 Hz | 22,050 Hz |
| 格式 | 16-bit PCM、單聲道 | 16-bit PCM、單聲道 |
| 峰值 | −10.67 dBFS | −15.92 dBFS |
| 整段 RMS | −34.63 dBFS | −19.55 dBFS |

兩個 WAV 不同。A 瞬間峰值較高，B 整段平均能量較高；RMS 差約 15.08 dB。這些數值不是人耳響度測量，聽感請直接試聽，不能把 RMS 差當作聽感必然相差 15 dB。

原檔 SHA256 與完整數據見 `STOP_SOUND_COMPARISON.json`。

## 本機試聽

- A：`D:/git/i-want-to-say/.tools/stop-sound-comparison/A-sharex.wav`
- B：`D:/git/i-want-to-say/.tools/stop-sound-comparison/B-before-you-do.wav`
- A → 靜音 1 秒 → B：`D:/git/i-want-to-say/.tools/stop-sound-comparison/A-then-B.wav`
- 獨立播放器頁面：`D:/git/i-want-to-say/.tools/stop-sound-comparison/index.html`

原檔不正規化、不改音量。串接檔僅將 B 線性重採樣至 44.1 kHz 以符合 WAV 格式；可分別播放原檔。三個檔案均經 headless browser 實際解碼與靜音播放驗證，沒有在桌面自動播放。

ShareX 原始檔只留在本機比較資料夾；保留來源與 GPL license 副本，未加入 MIT App 的音效或 Release 資源。
