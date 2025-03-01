import { APIError, AnonymousAPIClient } from './anonymous-api'
import { callWithSession } from './thi-session-handler'

import courseShortNames from '../../data/course-short-names.json'

const KEY_GET_PERSONAL_DATA = 'getPersonalData'
const KEY_GET_TIMETABLE = 'getTimetable'
const KEY_GET_EXAMS = 'getExams'
const KEY_GET_GRADES = 'getGrades'
const KEY_GET_MENSA_PLAN = 'getMensaPlan'
const KEY_GET_FREE_ROOMS = 'getFreeRooms'
const KEY_GET_PARKING_DATA = 'getCampusParkingData'
const KEY_GET_PERSONAL_LECTURERS = 'getPersonalLecturers'
const KEY_GET_LECTURERS = 'getLecturers'

/**
 * Determines the users faculty.
 * @param {object} data Personal data
 * @returns {string} Faculty name (e.g. `Informatik`)
 */
function extractFacultyFromPersonalData(data) {
  if (
    !data ||
    !data.persdata ||
    (!data.persdata.stg && !data.persdata.po_url)
  ) {
    return null
  }

  const faculties = Object.keys(courseShortNames).filter(
    (key) => key !== '_source'
  )

  // try to match the faculty by the PO URL (shortNames.json courses are not always up to date)
  const poKey = data.persdata.po_url
    .split('/')
    .filter((x) => x.length > 0)
    .slice(-3)[0]
  const facultyMatch = faculties
    .filter((key) => key !== '_source')
    .find((faculty) => courseShortNames[faculty].poKey === poKey)

  if (facultyMatch) {
    return facultyMatch
  }

  const shortName = data.persdata.stg
  const faculty = faculties.find((faculty) =>
    courseShortNames[faculty].courses.includes(shortName)
  )

  return faculty
}

/**
 * Determines the users SPO version.
 * @param {object} data Personal data
 * @returns {string}
 */
function extractSpoFromPersonalData(data) {
  if (!data || !data.persdata || !data.persdata.po_url) {
    return null
  }

  const split = data.persdata.po_url.split('/').filter((x) => x.length > 0)
  return split[split.length - 1]
}

/**
 * Client for accessing the API as a particular user.
 *
 * @see {@link https://github.com/neuland-ingolstadt/neuland.app/blob/develop/docs/thi-rest-api.md}
 */
export class AuthenticatedAPIClient extends AnonymousAPIClient {
  constructor() {
    super()

    this.sessionHandler = callWithSession
  }

  /**
   * Performs an authenticated request against the API
   * @param {object} params Request data
   * @returns {object}
   */
  async requestAuthenticated(params) {
    return await this.sessionHandler(async (session) => {
      const res = await this.request({
        session,
        ...params,
      })

      // old status format
      if (res.status !== 0) {
        throw new APIError(res.status, res.data)
      }
      // new status format
      if (res.data[0] !== 0) {
        throw new APIError(res.data[0], res.data[1])
      }

      return res.data[1]
    })
  }

  /**
   * Performs an authenticated and cached request against the API
   * @param {string} cacheKey Unique key that identifies this request
   * @param {object} params Request data
   * @returns {object}
   */
  async requestCached(cacheKey, params) {
    const cached = this.cache.get(cacheKey)
    if (cached) {
      return cached
    }

    const resp = await this.requestAuthenticated(params)
    this.cache.set(cacheKey, resp)

    return resp
  }

  async getPersonalData() {
    const res = await this.requestCached(KEY_GET_PERSONAL_DATA, {
      service: 'thiapp',
      method: 'persdata',
      format: 'json',
    })

    return res
  }

  async getFaculty() {
    const data = await this.getPersonalData()
    return extractFacultyFromPersonalData(data)
  }

  async getSpoName() {
    const data = await this.getPersonalData()
    return extractSpoFromPersonalData(data)
  }

  async getTimetable(date, detailed = false) {
    try {
      const key = `${KEY_GET_TIMETABLE}-${date.toDateString()}-${detailed}`
      const res = await this.requestCached(key, {
        service: 'thiapp',
        method: 'stpl',
        format: 'json',
        day: date.getDate(),
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        details: detailed ? 1 : 0,
      })

      return {
        semester: res[0],
        holidays: res[1],
        timetable: res[2],
      }
    } catch (e) {
      // when the user did not select any classes, the timetable returns 'Query not possible'
      if (
        e.data === 'Query not possible' ||
        e.data === 'Time table does not exist'
      ) {
        return {
          timetable: [],
        }
      } else {
        throw e
      }
    }
  }

  async getExams() {
    try {
      const res = await this.requestCached(KEY_GET_EXAMS, {
        service: 'thiapp',
        method: 'exams',
        format: 'json',
        modus: '1', // what does this mean? if only we knew
      })

      return res
    } catch (e) {
      // when you have no exams the API sometimes returns "No exam data available"
      if (
        e.data === 'No exam data available' ||
        e.data === 'Query not possible'
      ) {
        return []
      } else {
        throw e
      }
    }
  }

  async getGrades() {
    const res = await this.requestCached(KEY_GET_GRADES, {
      service: 'thiapp',
      method: 'grades',
      format: 'json',
    })

    return res
  }

  async getMensaPlan() {
    const res = await this.requestCached(KEY_GET_MENSA_PLAN, {
      service: 'thiapp',
      method: 'mensa',
      format: 'json',
    })

    return res
  }

  /**
   * @param {Date} date Date to fetch the room availability for
   */
  async getFreeRooms(date) {
    const key = `${KEY_GET_FREE_ROOMS}-${date.toDateString()}`
    const res = await this.requestCached(key, {
      service: 'thiapp',
      method: 'rooms',
      format: 'json',
      day: date.getDate(),
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    })

    return res
  }

  async getCampusParkingData() {
    const res = await this.requestCached(KEY_GET_PARKING_DATA, {
      service: 'thiapp',
      method: 'parking',
      format: 'json',
    })

    return res
  }

  async getPersonalLecturers() {
    const res = await this.requestCached(KEY_GET_PERSONAL_LECTURERS, {
      service: 'thiapp',
      method: 'stpllecturers',
      format: 'json',
    })

    return res
  }

  /**
   * @param {string} from Single character indicating where to start listing the lecturers
   * @param {string} to Single character indicating where to end listing the lecturers
   */
  async getLecturers(from, to) {
    const key = `${KEY_GET_LECTURERS}-${from}-${to}`
    const res = await this.requestCached(key, {
      service: 'thiapp',
      method: 'lecturers',
      format: 'json',
      from,
      to,
    })

    return res
  }

  async getImprint() {
    const res = await this.requestAuthenticated({
      service: 'thiapp',
      method: 'impressum',
      format: 'json',
    })

    return res
  }
}

export default new AuthenticatedAPIClient()
