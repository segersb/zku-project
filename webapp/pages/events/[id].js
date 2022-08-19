import {useRouter} from "next/router";

export default function Event () {
  const router = useRouter()
  const {id} = router.query

  // let content
  // if (events.length === 0) {
  //   content = <Typography variant="body2" color="text.secondary">
  //     You haven't created any events yet
  //   </Typography>
  // } else {
  //   content = events.map(event =>
  //     <Typography variant="body2" color="text.secondary">
  //       {event.name}
  //     </Typography>
  //   )
  // }

  return (
    <>ID {id}</>
  )
}