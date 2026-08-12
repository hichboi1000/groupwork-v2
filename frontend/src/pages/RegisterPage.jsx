import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { register } from "../api/client";

import Button from "../components/ui/Button";
import Card from "../components/ui/Card";


const ROLES = [
  {
    value:"student",
    label:"Student — Join a group and complete tasks"
  },
  {
    value:"leader",
    label:"Leader — Create and manage a group"
  },
  {
    value:"rep",
    label:"Class Representative — Oversee groups"
  },
  {
    value:"lecturer",
    label:"Lecturer — Post assignments"
  },
];



export default function RegisterPage(){


const navigate = useNavigate();


const [form,setForm]=useState({

username:"",
email:"",
first_name:"",
last_name:"",
password:"",
role:"student"

});


const [error,setError]=useState("");

const [loading,setLoading]=useState(false);



const handle=(e)=>{

setForm({

...form,

[e.target.name]:e.target.value

});

};



const submit=async(e)=>{


e.preventDefault();

setError("");

setLoading(true);


try{


await register(form);


navigate("/login");


}catch(err){


const data=err.response?.data;


if(data){

setError(
Object.values(data)
.flat()
.join(" ")
);

}else{

setError(
"Registration failed. Try again."
);

}


}finally{


setLoading(false);


}


};




return(


<div
className="
min-h-screen
flex
items-center
justify-center
bg-status-todo-bg
px-4
py-10
">


<div
className="
w-full
max-w-lg
">



<div
className="
text-center
mb-8
">


<div
className="
mx-auto
w-16
h-16
rounded-[--radius-card]
bg-accent
text-surface
flex
items-center
justify-center
text-3xl
font-bold
">

G

</div>



<h1
className="
text-3xl
font-bold
mt-4
text-ink
">

Create Account

</h1>


<p
className="
text-muted
mt-2
">

Join your university workspace

</p>


</div>




<Card>


<form
onSubmit={submit}
className="space-y-5"
>



{error && (

<div
className="
bg-status-overdue-bg
border
border-status-overdue/30
text-status-overdue
p-3
rounded-[--radius-control]
text-sm
">

{error}

</div>

)}




<div
className="
grid
grid-cols-2
gap-4
">


<div>

<label className="text-sm font-medium">

First Name

</label>


<input

name="first_name"

value={form.first_name}

onChange={handle}

className="
mt-2
w-full
rounded-[--radius-control]
border
border-border-strong
px-4
py-3
outline-none
focus:ring-2
focus:ring-accent/30
"

required

/>

</div>




<div>

<label className="text-sm font-medium">

Last Name

</label>


<input

name="last_name"

value={form.last_name}

onChange={handle}

className="
mt-2
w-full
rounded-[--radius-control]
border
border-border-strong
px-4
py-3
outline-none
focus:ring-2
focus:ring-accent/30
"

required

/>

</div>


</div>





<div>

<label className="text-sm font-medium">

Username

</label>


<input

name="username"

value={form.username}

onChange={handle}

className="
mt-2
w-full
rounded-[--radius-control]
border
border-border-strong
px-4
py-3
outline-none
focus:ring-2
focus:ring-accent/30
"

required

/>

</div>





<div>

<label className="text-sm font-medium">

Email

</label>


<input

type="email"

name="email"

value={form.email}

onChange={handle}

className="
mt-2
w-full
rounded-[--radius-control]
border
border-border-strong
px-4
py-3
outline-none
focus:ring-2
focus:ring-accent/30
"

/>

</div>





<div>

<label className="text-sm font-medium">

Password

</label>


<input

type="password"

name="password"

value={form.password}

onChange={handle}

className="
mt-2
w-full
rounded-[--radius-control]
border
border-border-strong
px-4
py-3
outline-none
focus:ring-2
focus:ring-accent/30
"

required

/>

</div>






<div>


<label className="text-sm font-medium">

Account Type

</label>


<select

name="role"

value={form.role}

onChange={handle}

className="
mt-2
w-full
rounded-[--radius-control]
border
border-border-strong
px-4
py-3
bg-surface
outline-none
focus:ring-2
focus:ring-accent/30
"

>


{ROLES.map(role=>(

<option
key={role.value}
value={role.value}
>

{role.label}

</option>


))}


</select>


</div>





<Button

type="submit"

loading={loading}

className="w-full"

>

Create Account

</Button>





<p
className="
text-center
text-sm
text-muted
mt-5
">

Already have an account?

{" "}


<Link

to="/login"

className="
text-accent-dark
font-medium
"

>

Sign In

</Link>


</p>




</form>


</Card>



</div>


</div>


);


}