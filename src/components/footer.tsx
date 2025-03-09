import { Facebook, Instagram } from "@mui/icons-material"
import Link from "next/link"
import { styled } from "@mui/material/styles"

// Import icons individually
import BicycleGallery from "../icons/BicycleGallery"
import BicycleShop from "../icons/BicycleShop"
import CapeFearCyclists from "../icons/CapeFearCyclists"
import CapeFearSorba from "../icons/CapeFearSorba"
import Icons from "../icons/Icons"

const friends = [
  {
    title: "Bicycle Gallery",
    icon: <BicycleGallery />,
    link: "https://www.bicycle-gallery.com/",
  },
  {
    title: "Bicycle Shop",
    icon: <BicycleShop />,
    link: "https://www.thebicycle.com",
  },
  {
    title: "Cape Fear Cyclists",
    icon: <CapeFearCyclists />,
    link: "https://www.capefearcyclists.org/",
  },
  {
    title: "Cape Fear Sorba",
    icon: <CapeFearSorba />,
    link: "https://capefearsorba.org/",
  },
]

const Footer = () => {
  return (
    <>
      <footer className="bg-gray-100 text-gray-700 py-8 px-4">
        <div className="container mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex flex-col items-center">
            <h1 className="text-2xl font-bold text-center mb-4">
              Connect
            </h1>
            <div className="flex space-x-8 items-center">
              <a
                aria-label="Down east cyclists Facebook"
                href="https://www.facebook.com/downeastcyclists"
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center justify-center"
              >
                <Facebook
                  sx={{ fontSize: 48 }}
                  className="fb-circle"
                />
              </a>
              <a
                aria-label="down east cyclists instagram"
                href="https://www.instagram.com/downeastcyclists/"
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center justify-center"
              >
                <Instagram sx={{ fontSize: 48 }} className="instagram" />
              </a>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <h1 className="text-2xl font-bold text-center mb-4">
              Links
            </h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              {friends &&
                friends.map(friend => {
                  return (
                    <div key={friend.title} className="flex justify-center">
                      <a
                        target="_blank"
                        aria-label={friend.title}
                        rel="noreferrer noopener"
                        href={friend.link}
                        title={friend.title}
                      >
                        <StyledIcon>{friend.icon}</StyledIcon>
                      </a>
                    </div>
                  )
                })}
            </div>
          </div>
          <div className="flex flex-col items-center">
            <h1 className="text-2xl font-bold text-center mb-4">
              Weekly Mileage
            </h1>
            <div className="text-center">
              <iframe
                title="Strava Club Mileage"
                height="160"
                width="300"
                // allowTransparency={true}
                scrolling="no"
                loading="lazy"
                src="https://www.strava.com/clubs/down-east-cyclists/latest-rides/8683108f61f96a7b5c9c472f4176a0b942b74964?show_rides=false"
              ></iframe>
            </div>
          </div>
        </div>
        <div className="mt-8 text-center">
          <h2 className="text-lg">
            <Link href="/dashboard">
              &copy;{new Date().getFullYear()} Down East Cyclists
            </Link>
          </h2>
        </div>
      </footer>
    </>
  )
}
export default Footer

const StyledIcon = styled(Icons)(({ theme }) => ({
  '& svg': {
    fill: '#000000',
    '&:hover': {
      transition: '0.2s linear',
      fill: '#ef1a25'
    }
  }
}));
