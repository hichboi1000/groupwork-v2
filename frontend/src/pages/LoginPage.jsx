import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";


export default function LoginPage(){

    const {login}=useAuth();
    const navigate=useNavigate();


    const [form,setForm]=useState({
        username:"",
        password:""
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

            await login(
                form.username,
                form.password
            );

            navigate("/");

        }catch{

            setError(
                "Invalid username or password"
            );

        }finally{

            setLoading(false);

        }

    };



    return(

<div className="
min-h-screen
flex
items-center
justify-center
bg-status-todo-bg
px-4
">


<div className="w-full max-w-md">


<div className="
text-center
mb-8
">


<div className="
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


<h1 className="
text-3xl
font-bold
mt-4
text-ink
">

GroupWork

</h1>


<p className="
text-muted
mt-2
">

Sign in to your account

</p>


</div>



<Card>


<form
onSubmit={submit}
className="space-y-5"
>


{error && (

<div className="
bg-status-overdue-bg
text-status-overdue
p-3
rounded-[--radius-control]
text-sm
">

{error}

</div>

)}



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



<Button
type="submit"
loading={loading}
className="w-full"
>

Sign In

</Button>



<p className="
text-center
text-sm
text-muted
mt-5
">

Don't have an account?

{" "}

<Link
to="/register"
className="text-accent-dark font-medium"
>

Register

</Link>


</p>



</form>


</Card>


</div>


</div>


    );

}