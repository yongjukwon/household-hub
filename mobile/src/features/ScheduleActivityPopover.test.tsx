import { fireEvent, render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { ScheduleActivityPopover } from './ScheduleActivityPopover'
import type { InboxNotification } from './notifications'

const activity: InboxNotification = {
  id: '33333333-3333-4333-8333-333333333333',
  actorUserId: '22222222-2222-4222-8222-222222222222',
  kind: 'calendar.event.created',
  entityType: 'calendar_event',
  entityId: '44444444-4444-4444-8444-444444444444',
  payload: {
    actorName: 'Claire',
    title: 'Dinner',
    allDay: false,
    startAt: '2026-08-08T01:00:00.000Z',
    endAt: '2026-08-08T02:00:00.000Z',
    timezone: 'America/Vancouver',
  },
  readAt: null,
  createdAt: '2026-08-07T18:00:00.000Z',
  revision: 1,
}

describe('ScheduleActivityPopover', () => {
  it('anchors under the bell, scrolls, and distinguishes unread activity accessibly', async () => {
    const view = await render(
      <ScheduleActivityPopover
        open
        topInset={44}
        notifications={[activity]}
        onOpenChange={() => undefined}
        onOpenActivity={() => undefined}
        onRemove={() => undefined}
        onClear={() => undefined}
      />,
    )

    expect(StyleSheet.flatten(view.getByTestId('activity-popover').props.style)).toMatchObject({
      position: 'absolute',
      top: 92,
      right: 20,
      maxHeight: 460,
    })
    expect(view.getByTestId('activity-scroll')).toBeTruthy()
    expect(view.getByLabelText(/Unread.*Claire added Dinner/)).toBeTruthy()
    expect(view.getByTestId('activity-unread-dot')).toBeTruthy()
  })

  it('opens create activity, keeps deleted activity in place, and supports Remove', async () => {
    const open = jest.fn()
    const remove = jest.fn()
    const deleted = { ...activity, id: '55555555-5555-4555-8555-555555555555', kind: 'calendar.event.deleted' }
    const view = await render(
      <ScheduleActivityPopover
        open
        topInset={0}
        notifications={[activity, deleted]}
        onOpenChange={() => undefined}
        onOpenActivity={open}
        onRemove={remove}
        onClear={() => undefined}
      />,
    )

    await fireEvent.press(view.getByLabelText(/Unread.*Claire added Dinner/))
    await fireEvent.press(view.getByLabelText(/Unread.*Claire removed Dinner/))
    await fireEvent.press(view.getAllByLabelText('Remove activity')[0])

    expect(open).toHaveBeenNthCalledWith(1, activity, true)
    expect(open).toHaveBeenNthCalledWith(2, deleted, false)
    expect(remove).toHaveBeenCalledWith(activity)
  })

  it('requires confirmation before Clear all', async () => {
    const clear = jest.fn()
    const view = await render(
      <ScheduleActivityPopover
        open
        topInset={0}
        notifications={[activity]}
        onOpenChange={() => undefined}
        onOpenActivity={() => undefined}
        onRemove={() => undefined}
        onClear={clear}
      />,
    )

    await fireEvent.press(view.getByLabelText('Clear all activity'))
    expect(clear).not.toHaveBeenCalled()
    expect(view.getByText('Clear all activity?')).toBeTruthy()
    await fireEvent.press(view.getAllByText('Clear all')[1])
    expect(clear).toHaveBeenCalledTimes(1)
  })
})
