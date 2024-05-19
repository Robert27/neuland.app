import React, { useEffect, useState } from 'react'
import ListGroup from 'react-bootstrap/ListGroup'
import { useRouter } from 'next/router'

import { Users } from 'lucide-react'

import BaseCard from './BaseCard'

import NeulandAPI from '../../lib/backend/neuland-api'

import { useTranslation } from 'next-i18next'

/**
 * Dashboard card for CL events.
 */
export default function EventsCard() {
  const router = useRouter()
  const [calendar, setCalendar] = useState([])
  const { t } = useTranslation(['dashboard'])

  useEffect(() => {
    async function load() {
      try {
        const events = await NeulandAPI.getCampusLifeEvents()
        setCalendar(events.clEvents)
      } catch (e) {
        // directly notifying the user about the error is not necessary here
        console.error(e)
      }
    }
    load()
  }, [router])

  return (
    <BaseCard
      icon={Users}
      i18nKey="events"
      link="/events"
    >
      <ListGroup variant="flush">
        {calendar.slice(0, 2).map((x, i) => (
          <ListGroup.Item key={i}>
            <div>{x.title}</div>
            <div className="text-muted">
              {t('events.organizer.attribute')} {x.organizer}
            </div>
          </ListGroup.Item>
        ))}
      </ListGroup>
    </BaseCard>
  )
}
