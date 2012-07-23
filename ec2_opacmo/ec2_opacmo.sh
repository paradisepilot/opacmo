#!/bin/bash

# set parameter values
opacmo_log_dir=opacmo_log
opacmo_keypair_dir=opacmo_keypairs
opacmo_keypair=opacmo_keypair
opacmo_security_group=opacmo_security_group
opacmo_downloader_ami=ami-aecd60c7
opacmo_downloader_instance_type=m1.small
opacmo_downloader_launch_script=opacmo-downloader-launch-script.txt

# make opacmo_log directory if it does not yet exist
if [[ ! -d ${opacmo_log_dir} ]]; then
    mkdir ${opacmo_log_dir}
fi

# make opacmo_keypairs directory if it does not yet exist
if [[ ! -d ${opacmo_keypair_dir} ]]; then
    mkdir ${opacmo_keypair_dir}
    chmod 700 ${opacmo_keypair_dir}
fi

# create new EC2 security key pair for opacmo instances if one does not yet exist
opacmo_keypair_found=`ec2-describe-keypairs | awk -F"\t" '$1~"^KEYPAIR" && $2=="opacmo_keypair"' | wc -l`
if [[ ${opacmo_keypair_found} = 0 ]]; then
    ec2-add-keypair ${opacmo_keypair} > ${opacmo_keypair_dir}/${opacmo_keypair}.pem 2> ${opacmo_log_dir}/log.ec2-add-keypair
    chmod 400 ${opacmo_keypair_dir}/*
fi

# create new EC2 security group for opacmo instances if one does not yet exist
# and add a rule to the newly created security group
opacmo_security_group_found=`ec2-describe-group | awk -F"\t" '$1~"^GROUP" && $3=="opacmo_security_group"' | wc -l`
if [[ ${opacmo_security_group_found} = 0 ]]; then
    ec2-add-group ${opacmo_security_group} -d "security group created specifically for running opacmo on Amazon EC2" > ${opacmo_log_dir}/log.ec2-add-group
    ec2-authorize ${opacmo_security_group} -p 22 -s 0.0.0.0/0 > ${opacmo_log_dir}/log.ec2-authorize 2> ${opacmo_log_dir}/log.ec2-authorize
fi

# Amazon Linux AMI 2012.03
ec2-run-instances ${opacmo_downloader_ami} --instance-type ${opacmo_downloader_instance_type} --key ${opacmo_keypair} --group ${opacmo_security_group} --user-data-file ${opacmo_downloader_launch_script} > ${opacmo_log_dir}/log.ec2-run-instances.downloader 2> ${opacmo_log_dir}/log.ec2-run-instances.downloader

echo
echo "ec2_opacmo: execution complete"
echo

