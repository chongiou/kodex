import { execSync as execCommandSync } from 'node:child_process'

export class Device {
	constructor(public host?: string) {
		if (host) {
			this.connect()
		}
	}
	static list(filterOffline: boolean = true) {
		const res = this.prototype.exec('adb devices')
		if (res.error) {
			throw new Error(res.error)
		}
		const middle = res.stdout.trim().split('\r\n').slice(1)
		const list = middle.map(it => {
			const [serial, status] = it.split('\t')
			return { serial, status }
		})
		return filterOffline ? list.filter(it => it.status === 'device') : list
	}
	exec(command: string): { stdout: string, stderr: string | null, error: string | null } {
		try {
			const stdout = execCommandSync(command, {
				env: { ANDROID_SERIAL: this.host },
				encoding: 'utf8',
				stdio: 'pipe', // 捕获标准输出和标准错误流
			})
			return { stdout, stderr: null, error: null }
		} catch (err: any) {
			return { stdout: err.stdout, stderr: err.stderr, error: err.message }
		}
	}
	connect() {
		const res = this.exec(`adb connect ${this.host}`)
		if (res.stdout.includes('cannot')) {
			throw new Error(res.stdout)
		}
	}
	/** 反向端口转发 */
	reverse(remote: number, local: number) {
		return this.exec(`adb reverse tcp:${remote} tcp:${local}`)
	}
	removeReverse(port?: number) {
		const removeMethod = port ? `--remove tcp:${port}` : "--remove-all"
		return this.exec(`adb reverse ${removeMethod}`)
	}
	push(local: string, remote: string) {
		return this.exec(`adb push ${local} ${remote}`)
	}
	startScheme(protocol: string) {
		return this.exec(`adb shell am start --activity-single-top -a android.intent.action.VIEW -d "${protocol}"`)
	}
	getCurrentActivity() {
		try {
			// cspell: disable-next-line
			const { stdout } = this.exec(`adb shell dumpsys activity activities | grep "topResumedActivity"`)
			// console.debug('topResumedActivity输出:', stdout)

			// 匹配 topResumedActivity=ActivityRecord{xxx u0 package/.activity xxx}
			const match = stdout.match(/topResumedActivity=ActivityRecord\{[^}]+\s+([^/\s]+)(\/[^}\s]+)/)
			if (match) {
				const packageName = match[1]
				const activityName = match[2]

				// 处理简写形式
				const fullActivityName = activityName.startsWith('/.')
					? packageName + activityName
					: packageName + '/' + activityName

				// console.debug('解析出的Activity:', fullActivityName)
				return fullActivityName
			}

			return null
		} catch (error) {
			console.error('获取当前Activity失败:', error)
			return null
		}
	}
	startActivity(activityName: string) {
		try {
			return this.exec(`adb shell cmd activity start-activity -n ${activityName}`)
		} catch (error) {
			console.error('启动Activity失败:', error)
			return false
		}
	}
	/**
	 * 启动自动精灵脚本
	 * @param filename 
	 */
	startScript(filename: string) {
		const currentActivity = this.getCurrentActivity()
		if (!currentActivity) {
			console.log('无法获取当前 Activity:', currentActivity)
		}

		// 启动无障碍和媒体投屏权限
		// cspell: disable
		this.exec(`adb shell settings put secure enabled_accessibility_services com.zdanjian.zdanjian/com.zdanjian.zdanjian.accessibility.ZDAccessibilityServer`)
		this.exec(`adb shell settings put secure accessibility_enabled 1`)
		this.exec(`adb shell cmd appops set com.zdanjian.zdanjian PROJECT_MEDIA allow`)
		const { error } = this.startScheme(`zdjl://clientcall/zdOpenScript?run=1'&'filePath=${filename}`)
		// cspell: enable
		if (error) {
			console.error(new Error(error))
		}

		const success = currentActivity && this.startActivity(currentActivity)
		if (!success) {
			console.log('无法回到之前的 Activity:', currentActivity)
		}
	}
}

export default Device
