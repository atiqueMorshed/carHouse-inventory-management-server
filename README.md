# carHouse - Car Inventory Management

> CarHouse is an inventory management website. It lets you add your cars to the inventory items. Whenever a car is delivered, you can update the infomation by clicking on the delivered button on the car page. That'll update the quantity and sold fields accordingly. You can also restock your inventory by a set amount in that page. You can also see car sales information in the homepage.

.

> [frontend](https://carhouse-warehouse-management.web.app/)
> or https://carhouse-warehouse-management.web.app/
>
> [backend](https://carhouse-backend.herokuapp.com/)
> or https://carhouse-backend.herokuapp.com/

## Features

- Dynamically loads home page slider, showcase, sales graph information.
- When adding a new car, you can select whether to use it in the homepage slider.
- Users can login and register with their email or use Google or Facebook login system.
- Pages like Add, Manage, My Car are kept private and is authorized with JWT, which keeps unauthorized users from changing any information. Also, users who are logged out cannot view these pages. After login, user is automatically redirected to the appropriate page that they came in from.
- Header shows currently active link.
- Fully responsive site that allows a user to browse from any device.

## Notable Technologies

### Front End

- react
- react-router-dom
- react-query
- react-helmet-async
- react-error-boundary
- axios
- firebase
- react-firebase-hooks
- react-hook-form
- tailwind
- react-toastify
- swiper
- react-leaflet

### Back End

- express
- mongodb
- jsonwebtoken
- cors
- dotenv
